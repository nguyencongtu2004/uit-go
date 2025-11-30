output "eks_nodes_sg_id" {
  description = "Security group ID for EKS nodes"
  value       = aws_security_group.eks_nodes.id
}

output "app_pods_sg_id" {
  description = "Security group ID for application pods"
  value       = aws_security_group.app_pods.id
}
