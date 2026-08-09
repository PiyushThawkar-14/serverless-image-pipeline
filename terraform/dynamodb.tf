# The shell script created this table with a `jobId` hash key, but the handler has always
# written items keyed by `imageId` - every write went to a table whose key schema did not
# match, so the stack only ever worked because nobody ran the script and the handler against
# each other. The IaC uses the key the code actually writes.
resource "aws_dynamodb_table" "metadata" {
  name         = "${local.name_prefix}-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "imageId"

  attribute {
    name = "imageId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }
}
