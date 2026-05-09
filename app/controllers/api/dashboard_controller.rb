# frozen_string_literal: true

module Api
  class DashboardController < ApplicationController
    skip_forgery_protection

    ALLOWED_RANGES = { "7d" => 7, "30d" => 30, "90d" => 90 }.freeze
    ALLOWED_STATUSES = %w[completed preparing pending ready cancelled].freeze

    def kpi_stats
      render json: {
        stats: Restaurant.dashboard_kpi_stats(days: range_days, status: filter_status),
        timestamp: Time.current.iso8601
      }
    end

    def revenue_data
      render json: {
        data: Restaurant.dashboard_revenue_by_day(days: [range_days * 2, 14].max, status: filter_status),
        timestamp: Time.current.iso8601
      }
    end

    def order_status
      # Donut chart intentionally shows full distribution regardless of status filter.
      render json: {
        data: Restaurant.dashboard_order_status(days: range_days),
        timestamp: Time.current.iso8601
      }
    end

    def recent_orders
      render json: {
        orders: Restaurant.dashboard_recent_orders(days: range_days, status: filter_status),
        timestamp: Time.current.iso8601
      }
    end

    def top_menu_items
      render json: {
        items: Restaurant.dashboard_top_menu_items,
        timestamp: Time.current.iso8601
      }
    end

    def hourly_distribution
      render json: {
        data: Restaurant.dashboard_hourly_distribution(days: range_days, status: filter_status),
        timestamp: Time.current.iso8601
      }
    end

    private

    def range_days
      ALLOWED_RANGES[params[:range].to_s] || 7
    end

    def filter_status
      candidate = params[:status].to_s
      ALLOWED_STATUSES.include?(candidate) ? candidate : nil
    end
  end
end
