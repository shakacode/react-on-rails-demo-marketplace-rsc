# frozen_string_literal: true

# Dashboard analytics module — provides aggregation queries across all restaurants.
# With 10M orders and 30M order_lines, these queries have naturally different latencies,
# making them ideal for demonstrating RSC streaming advantages.
module DashboardAnalytics
  extend ActiveSupport::Concern

  class_methods do
    # Find the most recent data window — the latest 90 days with data
    def dashboard_data_window
      max_date = Order.maximum(:placed_at)
      return [90.days.ago, Time.current] unless max_date

      [max_date - 90.days, max_date]
    end

    # KPI statistics — scans orders for counts and sums.
    # `days:` controls the look-back window and the period-over-period comparison.
    # `status:` optionally narrows to a single order status.
    def dashboard_kpi_stats(days: 7, status: nil)
      _, window_end = dashboard_data_window
      cutoff = window_end - days.days
      prev_cutoff = cutoff - days.days

      base = Order.where(placed_at: cutoff..window_end)
      base = base.where(status: status) if status.present?
      prev_base = Order.where(placed_at: prev_cutoff..cutoff)
      prev_base = prev_base.where(status: status) if status.present?

      stats = base.select(
                     "COUNT(*) as total_orders",
                     "COALESCE(SUM(total_price), 0) as total_revenue",
                     "COALESCE(AVG(total_price), 0) as avg_order_value",
                     "COUNT(*) FILTER (WHERE status = 'completed') as completed_orders",
                     "COUNT(*) FILTER (WHERE is_delivery = true) as delivery_orders"
                   ).take

      prev_stats = prev_base.select(
                          "COUNT(*) as total_orders",
                          "COALESCE(SUM(total_price), 0) as total_revenue",
                          "COALESCE(AVG(total_price), 0) as avg_order_value",
                          "COUNT(*) FILTER (WHERE status = 'completed') as completed_orders"
                        ).take

      total = stats.total_orders.to_i
      prev_total = prev_stats.total_orders.to_i

      {
        revenue: stats.total_revenue.to_f.round(2),
        revenue_change: percent_change(prev_stats.total_revenue.to_f, stats.total_revenue.to_f),
        order_count: total,
        order_count_change: percent_change(prev_total.to_f, total.to_f),
        avg_order_value: stats.avg_order_value.to_f.round(2),
        avg_order_value_change: percent_change(prev_stats.avg_order_value.to_f, stats.avg_order_value.to_f),
        completion_rate: total > 0 ? (stats.completed_orders.to_f / total * 100).round(1) : 0,
        delivery_rate: total > 0 ? (stats.delivery_orders.to_f / total * 100).round(1) : 0
      }
    end

    # Daily revenue for area chart — GROUP BY day across all orders
    # With 10M rows: ~500ms-1s
    def dashboard_revenue_by_day(days: 14, status: nil)
      _, window_end = dashboard_data_window
      cutoff = window_end - days.days

      scope = Order.where(placed_at: cutoff..window_end)
      scope = scope.where(status: status) if status.present?
      scope.group("date_trunc('day', placed_at)::date")
           .order(Arel.sql("date_trunc('day', placed_at)::date"))
           .pluck(
             Arel.sql("date_trunc('day', placed_at)::date"),
             Arel.sql("SUM(total_price)"),
             Arel.sql("COUNT(*)")
           ).map do |date, revenue, count|
        { date: date.to_s, revenue: revenue.to_f.round(2), orders: count }
      end
    end

    # Order status distribution for donut chart
    # With 10M rows: ~200-400ms
    def dashboard_order_status(days: 7)
      _, window_end = dashboard_data_window
      cutoff = window_end - days.days

      Order.where(placed_at: cutoff..window_end)
           .group(:status)
           .order(Arel.sql("COUNT(*) DESC"))
           .pluck(:status, Arel.sql("COUNT(*)"))
           .map { |status, count| { status: status, count: count } }
    end

    # Recent orders with item details — JOIN with order_lines + menu_items
    # Queries most recent 15 orders across all restaurants
    def dashboard_recent_orders(limit: 15, days: 7, status: nil)
      _, window_end = dashboard_data_window
      cutoff = window_end - days.days

      scope = Order.where(placed_at: cutoff..window_end)
      scope = scope.where(status: status) if status.present?

      scope.includes(:restaurant, order_lines: :menu_item)
           .order(placed_at: :desc)
           .limit(limit)
           .map do |order|
        items = order.order_lines.map do |ol|
          { name: ol.menu_item.name, quantity: ol.quantity, price: ol.price_per_unit.to_f }
        end
        {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_price: order.total_price.to_f.round(2),
          items_count: order.order_lines.size,
          item_names: items.first(3).map { |i| i[:name] },
          is_delivery: order.is_delivery,
          placed_at: order.placed_at.iso8601,
          completed_at: order.completed_at&.iso8601
        }
      end
    end

    # Top selling menu items — sampled approach for performance
    # Aggregates from a subset of recent orders (last 50K orders)
    def dashboard_top_menu_items(limit: 10)
      _, window_end = dashboard_data_window

      sql = <<~SQL
        SELECT m.name, m.category, m.price,
               SUM(ol.quantity) as total_quantity,
               SUM(ol.quantity * ol.price_per_unit) as total_revenue
        FROM order_lines ol
        INNER JOIN (
          SELECT id FROM orders
          WHERE placed_at <= $1
          ORDER BY placed_at DESC
          LIMIT 50000
        ) recent_orders ON recent_orders.id = ol.order_id
        INNER JOIN menu_items m ON m.id = ol.menu_item_id
        GROUP BY m.id, m.name, m.category, m.price
        ORDER BY total_revenue DESC
        LIMIT $2
      SQL

      ActiveRecord::Base.connection.exec_query(
        sql, "Dashboard Top Items", [
          ActiveRecord::Relation::QueryAttribute.new("window_end", window_end, ActiveRecord::Type::DateTime.new),
          ActiveRecord::Relation::QueryAttribute.new("limit", limit, ActiveRecord::Type::Integer.new),
        ]
      ).rows.map do |name, category, price, qty, revenue|
        {
          name: name,
          category: category,
          price: price.to_f,
          total_quantity: qty.to_i,
          total_revenue: revenue.to_f.round(2)
        }
      end
    end

    # Hourly order distribution — GROUP BY hour across all orders
    # With 10M rows: ~300-600ms
    def dashboard_hourly_distribution(days: 7, status: nil)
      _, window_end = dashboard_data_window
      cutoff = window_end - days.days

      scope = Order.where(placed_at: cutoff..window_end)
      scope = scope.where(status: status) if status.present?
      scope.group(Arel.sql("EXTRACT(hour FROM placed_at)::integer"))
           .order(Arel.sql("EXTRACT(hour FROM placed_at)::integer"))
           .pluck(
             Arel.sql("EXTRACT(hour FROM placed_at)::integer"),
             Arel.sql("COUNT(*)"),
             Arel.sql("AVG(total_price)")
           ).map do |hour, count, avg|
        { hour: hour, orders: count, avg_value: avg.to_f.round(2) }
      end
    end

    private

    def percent_change(old_val, new_val)
      return 0.0 if old_val.zero?
      ((new_val - old_val) / old_val * 100).round(1)
    end
  end
end
