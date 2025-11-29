kubectl port-forward svc/traefik 8080:8080 8000:80
kubectl port-forward svc/user-service 81:3000
kubectl port-forward svc/trip-service 82:3000
