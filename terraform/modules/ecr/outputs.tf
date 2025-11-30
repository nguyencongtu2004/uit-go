output "repository_urls" {
  description = "Map of repository names to URLs"
  value = {
    for repo in aws_ecr_repository.main :
    repo.name => repo.repository_url
  }
}

output "repository_arns" {
  description = "Map of repository names to ARNs"
  value = {
    for repo in aws_ecr_repository.main :
    repo.name => repo.arn
  }
}
