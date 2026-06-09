class ApplicationController < ActionController::Base
  around_action :apply_db_delay

  helper_method :deployed_commit_sha, :deployed_commit_short_sha, :deployed_commit_url

  private

  def deployed_commit_sha
    BuildMetadata.commit_sha
  end

  def deployed_commit_short_sha
    BuildMetadata.short_commit_sha
  end

  def deployed_commit_url
    BuildMetadata.commit_url
  end

  def apply_db_delay
    delay_ms = params[:delay].to_i
    if delay_ms > 0
      delay_seconds = delay_ms / 1000.0
      subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        next if payload[:name] == "SCHEMA" || payload[:name]&.include?("EXPLAIN")
        next if payload[:sql]&.start_with?("SET ", "SHOW ", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE")

        sleep(delay_seconds)
      end
      begin
        yield
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber)
      end
    else
      yield
    end
  end
end
