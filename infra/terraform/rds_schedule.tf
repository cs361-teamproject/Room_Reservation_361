# Stop the database at night to save instance hours (storage is still billed).
# While it is stopped the API answers errors: /health shows database "down".
# Starting takes ~5-10 minutes, so the start runs before people need the system.
#
# The role is owned by the account admin (only rds:StopDBInstance / StartDBInstance on this
# account's DBs, assumable by EventBridge Scheduler), so it is read here, not managed.

data "aws_iam_role" "rds_scheduler" {
  name = "roomres-rds-scheduler"
}

locals {
  rds_schedules = {
    stop  = { action = "stopDBInstance", cron = var.rds_stop_cron }
    start = { action = "startDBInstance", cron = var.rds_start_cron }
  }
}

resource "aws_scheduler_schedule" "rds" {
  for_each = local.rds_schedules

  name        = "roomres-rds-${each.key}"
  description = "${each.key} ${aws_db_instance.postgres.identifier} (night saving)"
  state       = var.rds_night_stop_enabled ? "ENABLED" : "DISABLED"

  schedule_expression          = each.value.cron
  schedule_expression_timezone = "Asia/Bangkok"

  flexible_time_window {
    mode = "OFF"
  }

  # Universal target: calls the RDS API directly, no Lambda in between
  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:${each.value.action}"
    role_arn = data.aws_iam_role.rds_scheduler.arn
    input    = jsonencode({ DbInstanceIdentifier = aws_db_instance.postgres.identifier })

    # Stopping an already stopped DB (or the reverse) fails; don't keep retrying it
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
