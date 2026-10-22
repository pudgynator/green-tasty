resource "aws_scheduler_schedule" "weekly_reports" {
  name        = "weekly-reports-schedule"
  group_name  = "default"
  description = "Weekly reports generation"

  schedule_expression          = "cron(0 8 ? * FRI *)"
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.report_sender.arn
    role_arn = aws_iam_role.event_bridge.arn

    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 3
    }
  }
}
