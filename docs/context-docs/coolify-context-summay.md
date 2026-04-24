# Coolify

Coolify is an open-source, self-hosted Platform as a Service (PaaS) that serves as an alternative to cloud platforms like Vercel, Heroku, and Railway. It enables developers to deploy and manage applications, databases, and services on their own servers with full control over infrastructure, data, and costs. Coolify supports any Docker-compatible application, offers 200+ one-click service templates, automatic SSL certificates via Let's Encrypt, git integration with major providers (GitHub, GitLab, Bitbucket, Gitea), and a powerful REST API for automation.

The platform works by connecting to your servers via SSH and managing Docker containers for your deployments. It provides a clean web dashboard for resource management, supports multiple servers and environments, handles automatic backups to S3-compatible storage, and includes built-in monitoring and notifications. Whether you're running a single application or managing a complex multi-server setup, Coolify simplifies the self-hosting experience while maintaining complete flexibility and avoiding vendor lock-in.

## Installation

Quick installation script for Linux servers (Ubuntu, Debian, CentOS, Alpine, etc.):

```bash
# Quick installation (recommended)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash

# Installation with admin account pre-configured
env ROOT_USERNAME=admin \
ROOT_USER_EMAIL=admin@example.com \
ROOT_USER_PASSWORD=SecurePassword123 \
bash -c 'curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash'

# Custom Docker network pool
env DOCKER_ADDRESS_POOL_BASE=172.16.0.0/12 \
DOCKER_ADDRESS_POOL_SIZE=20 \
bash -c 'curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash'

# Disable auto-updates
env AUTOUPDATE=false \
bash -c 'curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash'
```

## API Authentication

All API requests require a Bearer token in the Authorization header. Generate tokens from the Coolify UI under Keys & Tokens > API tokens.

```bash
# API base URL
# Self-hosted: http://<your-server-ip>:8000/api/v1
# Coolify Cloud: https://app.coolify.io/api/v1

# Example authenticated request
curl -X GET "https://app.coolify.io/api/v1/applications" \
  -H "Authorization: Bearer 3|WaobqX9tJQshKPuQFHsyApxuOOggg4wOfvGc9xa233c376d7" \
  -H "Content-Type: application/json"

# Token permissions:
# - read-only (default): Read data only, no sensitive info
# - read:sensitive: Read data including sensitive information
# - view:sensitive: View passwords, API keys (normally redacted)
# - * : Full access to all resources and sensitive data
```

## List All Applications

Retrieve all applications in your Coolify instance, optionally filtered by tag.

```bash
# List all applications
curl -X GET "https://app.coolify.io/api/v1/applications" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# Filter by tag
curl -X GET "https://app.coolify.io/api/v1/applications?tag=production" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# Response example:
# [
#   {
#     "uuid": "abc123-def456",
#     "name": "my-nextjs-app",
#     "description": "Production frontend",
#     "status": "running",
#     "build_pack": "nixpacks",
#     "domains": "https://myapp.example.com"
#   }
# ]
```

## Create Application from Public Repository

Deploy applications from public Git repositories using Nixpacks, Dockerfile, or Docker Compose build packs.

```bash
# Create a Node.js application from a public GitHub repository
curl -X POST "https://app.coolify.io/api/v1/applications/public" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "proj-uuid-here",
    "server_uuid": "server-uuid-here",
    "environment_name": "production",
    "git_repository": "https://github.com/username/my-nodejs-app",
    "git_branch": "main",
    "build_pack": "nixpacks",
    "ports_exposes": "3000",
    "name": "My Node.js App",
    "description": "Production deployment",
    "domains": "https://myapp.example.com",
    "is_auto_deploy_enabled": true,
    "instant_deploy": true,
    "health_check_enabled": true,
    "health_check_path": "/health",
    "health_check_interval": 30
  }'

# Response: { "uuid": "new-app-uuid" }

# Create a static site
curl -X POST "https://app.coolify.io/api/v1/applications/public" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "proj-uuid-here",
    "server_uuid": "server-uuid-here",
    "environment_name": "production",
    "git_repository": "https://github.com/username/my-static-site",
    "git_branch": "main",
    "build_pack": "static",
    "ports_exposes": "80",
    "name": "Marketing Site",
    "publish_directory": "/dist",
    "install_command": "npm install",
    "build_command": "npm run build",
    "is_static": true,
    "is_spa": true
  }'
```

## Create Application from Private Repository (GitHub App)

Deploy applications from private repositories using a configured GitHub App for authentication.

```bash
curl -X POST "https://app.coolify.io/api/v1/applications/private-github-app" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "proj-uuid-here",
    "server_uuid": "server-uuid-here",
    "environment_name": "staging",
    "github_app_uuid": "github-app-uuid",
    "git_repository": "https://github.com/myorg/private-repo",
    "git_branch": "develop",
    "build_pack": "dockerfile",
    "ports_exposes": "8080",
    "name": "Private API Service",
    "dockerfile_location": "/Dockerfile",
    "instant_deploy": true,
    "limits_memory": "512M",
    "limits_cpus": "1"
  }'
```

## Create Application from Dockerfile (No Git)

Deploy applications using a raw Dockerfile without any Git repository.

```bash
curl -X POST "https://app.coolify.io/api/v1/applications/dockerfile" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "proj-uuid-here",
    "server_uuid": "server-uuid-here",
    "environment_name": "production",
    "dockerfile": "FROM nginx:alpine\nCOPY ./html /usr/share/nginx/html\nEXPOSE 80",
    "ports_exposes": "80",
    "name": "Simple Nginx App",
    "domains": "https://nginx.example.com",
    "instant_deploy": true
  }'
```

## Get Application Details

Retrieve detailed information about a specific application by UUID.

```bash
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# Response includes: uuid, name, description, status, domains, git_repository,
# git_branch, build_pack, health_check settings, resource limits, etc.
```

## Update Application

Modify application settings including domains, build commands, health checks, and resource limits.

```bash
curl -X PATCH "https://app.coolify.io/api/v1/applications/abc123-def456" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated App Name",
    "description": "Updated description",
    "domains": "https://newdomain.example.com,https://www.newdomain.example.com",
    "git_branch": "release",
    "build_command": "npm run build:production",
    "health_check_enabled": true,
    "health_check_path": "/api/health",
    "health_check_interval": 60,
    "limits_memory": "1G",
    "limits_cpus": "2",
    "is_auto_deploy_enabled": true
  }'
```

## Application Lifecycle (Start/Stop/Restart)

Control application state programmatically.

```bash
# Start application
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/start" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Start with force rebuild (no cache)
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/start?force=true" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Start with instant deploy (skip queue)
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/start?instant_deploy=true" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Stop application
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/stop" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Restart application
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/restart" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Get Application Logs

Retrieve container logs from a running application.

```bash
# Get last 100 lines (default)
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/logs" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get specific number of lines
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/logs?lines=500" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Response: { "logs": "2024-01-15 10:30:00 Server started on port 3000\n..." }
```

## Environment Variables Management

Create, update, and delete environment variables for applications.

```bash
# List all environment variables
curl -X GET "https://app.coolify.io/api/v1/applications/abc123-def456/envs" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Create a new environment variable
curl -X POST "https://app.coolify.io/api/v1/applications/abc123-def456/envs" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DATABASE_URL",
    "value": "postgresql://user:pass@db.example.com:5432/mydb",
    "is_preview": false,
    "is_literal": true,
    "is_shown_once": true
  }'

# Update environment variable
curl -X PATCH "https://app.coolify.io/api/v1/applications/abc123-def456/envs" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DATABASE_URL",
    "value": "postgresql://user:newpass@db.example.com:5432/mydb"
  }'

# Bulk update environment variables
curl -X PATCH "https://app.coolify.io/api/v1/applications/abc123-def456/envs/bulk" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"key": "NODE_ENV", "value": "production"},
      {"key": "API_KEY", "value": "secret123", "is_shown_once": true},
      {"key": "DEBUG", "value": "false"}
    ]
  }'

# Delete environment variable
curl -X DELETE "https://app.coolify.io/api/v1/applications/abc123-def456/envs/env-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Deploy Applications

Trigger deployments by UUID or tag, supporting PR deployments and force rebuilds.

```bash
# Deploy by application UUID
curl -X GET "https://app.coolify.io/api/v1/deploy?uuid=abc123-def456" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Deploy multiple applications by UUID
curl -X GET "https://app.coolify.io/api/v1/deploy?uuid=abc123,def456,ghi789" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Deploy all applications with a specific tag
curl -X GET "https://app.coolify.io/api/v1/deploy?tag=production" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Deploy with force rebuild (no cache)
curl -X GET "https://app.coolify.io/api/v1/deploy?uuid=abc123-def456&force=true" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Deploy a specific Pull Request
curl -X GET "https://app.coolify.io/api/v1/deploy?uuid=abc123-def456&pr=42" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Response:
# {
#   "deployments": [
#     {
#       "message": "Deployment queued",
#       "resource_uuid": "abc123-def456",
#       "deployment_uuid": "deploy-uuid-123"
#     }
#   ]
# }
```

## Deployment Management

List, monitor, and cancel deployments.

```bash
# List all currently running deployments
curl -X GET "https://app.coolify.io/api/v1/deployments" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get specific deployment details
curl -X GET "https://app.coolify.io/api/v1/deployments/deploy-uuid-123" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# List deployments for a specific application (with pagination)
curl -X GET "https://app.coolify.io/api/v1/deployments/applications/abc123-def456?skip=0&take=10" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Cancel a running deployment
curl -X POST "https://app.coolify.io/api/v1/deployments/deploy-uuid-123/cancel" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Response: { "message": "Deployment cancelled successfully.", "status": "cancelled-by-user" }
```

## Create Database

Create managed databases with one-click setup. Supported types: PostgreSQL, MySQL, MariaDB, MongoDB, Redis, KeyDB, DragonFly, ClickHouse.

```bash
# Create a PostgreSQL database
curl -X POST "https://app.coolify.io/api/v1/databases/postgresql" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "name": "myapp-postgres",
    "description": "Production PostgreSQL database",
    "image": "postgres:16-alpine",
    "postgres_user": "appuser",
    "postgres_db": "myapp",
    "is_public": false,
    "limits_memory": "1G",
    "instant_deploy": true
  }'

# Create a Redis database
curl -X POST "https://app.coolify.io/api/v1/databases/redis" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "name": "myapp-redis",
    "image": "redis:7-alpine",
    "instant_deploy": true
  }'

# Create a MongoDB database
curl -X POST "https://app.coolify.io/api/v1/databases/mongodb" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "name": "myapp-mongo",
    "mongo_initdb_root_username": "admin",
    "image": "mongo:7",
    "instant_deploy": true
  }'

# Create a MySQL database
curl -X POST "https://app.coolify.io/api/v1/databases/mysql" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "name": "myapp-mysql",
    "mysql_database": "myapp",
    "mysql_user": "appuser",
    "image": "mysql:8",
    "instant_deploy": true
  }'
```

## Database Lifecycle (Start/Stop/Restart)

Control database state programmatically.

```bash
# Start database
curl -X GET "https://app.coolify.io/api/v1/databases/db-uuid-here/start" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Stop database
curl -X GET "https://app.coolify.io/api/v1/databases/db-uuid-here/stop" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Restart database
curl -X GET "https://app.coolify.io/api/v1/databases/db-uuid-here/restart" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Database Backups

Manage database backup configurations and executions.

```bash
# List backup configurations for a database
curl -X GET "https://app.coolify.io/api/v1/databases/db-uuid-here/backups" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# List backup executions for a specific backup configuration
curl -X GET "https://app.coolify.io/api/v1/databases/db-uuid-here/backups/backup-config-uuid/executions" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Delete a backup execution
curl -X DELETE "https://app.coolify.io/api/v1/databases/db-uuid-here/backups/backup-config-uuid/executions/execution-uuid?delete_s3=true" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Create One-Click Service

Deploy pre-configured services from Coolify's 200+ template library (e.g., Gitea, Plausible, WordPress).

```bash
# Create a Gitea service
curl -X POST "https://app.coolify.io/api/v1/services" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "gitea",
    "name": "My Gitea Instance",
    "description": "Self-hosted Git service",
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "instant_deploy": true
  }'

# Create a service with custom URLs
curl -X POST "https://app.coolify.io/api/v1/services" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "plausible",
    "name": "Analytics",
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "urls": [
      {"name": "plausible", "url": "https://analytics.example.com"}
    ],
    "instant_deploy": true
  }'

# Create a custom service from Docker Compose
curl -X POST "https://app.coolify.io/api/v1/services" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Stack",
    "server_uuid": "server-uuid-here",
    "project_uuid": "proj-uuid-here",
    "environment_name": "production",
    "docker_compose_raw": "c2VydmljZXM6CiAgd2ViOgogICAgaW1hZ2U6IG5naW54OmFscGluZQogICAgcG9ydHM6CiAgICAgIC0gIjgwOjgwIg==",
    "instant_deploy": true
  }'

# Response: { "uuid": "service-uuid", "domains": ["https://auto-generated.sslip.io"] }
```

## Service Management

List, update, and control services.

```bash
# List all services
curl -X GET "https://app.coolify.io/api/v1/services" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get service details
curl -X GET "https://app.coolify.io/api/v1/services/service-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Update service
curl -X PATCH "https://app.coolify.io/api/v1/services/service-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Service Name",
    "description": "New description",
    "connect_to_docker_network": true
  }'

# Start service
curl -X GET "https://app.coolify.io/api/v1/services/service-uuid-here/start" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Stop service
curl -X GET "https://app.coolify.io/api/v1/services/service-uuid-here/stop" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Restart service
curl -X GET "https://app.coolify.io/api/v1/services/service-uuid-here/restart" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Delete service (with cleanup options)
curl -X DELETE "https://app.coolify.io/api/v1/services/service-uuid-here?delete_volumes=true&docker_cleanup=true" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Server Management

Manage servers connected to your Coolify instance.

```bash
# List all servers
curl -X GET "https://app.coolify.io/api/v1/servers" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get server details
curl -X GET "https://app.coolify.io/api/v1/servers/server-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get all resources on a server
curl -X GET "https://app.coolify.io/api/v1/servers/server-uuid-here/resources" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get all domains configured on a server
curl -X GET "https://app.coolify.io/api/v1/servers/server-uuid-here/domains" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Update server configuration
curl -X PATCH "https://app.coolify.io/api/v1/servers/server-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Server",
    "description": "Main production server",
    "proxy_type": "traefik"
  }'

# Validate server connection
curl -X GET "https://app.coolify.io/api/v1/servers/server-uuid-here/validate" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Delete server
curl -X DELETE "https://app.coolify.io/api/v1/servers/server-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Project and Environment Management

Organize resources with projects and environments.

```bash
# List all projects
curl -X GET "https://app.coolify.io/api/v1/projects" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get project details
curl -X GET "https://app.coolify.io/api/v1/projects/proj-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get project environment
curl -X GET "https://app.coolify.io/api/v1/projects/proj-uuid-here/production" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# List environments in a project
curl -X GET "https://app.coolify.io/api/v1/projects/proj-uuid-here/environments" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Private Keys Management

Manage SSH keys for server connections and deploy keys.

```bash
# List all private keys
curl -X GET "https://app.coolify.io/api/v1/security/keys" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get private key details
curl -X GET "https://app.coolify.io/api/v1/security/keys/key-uuid-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Teams Management

Manage teams and team members for collaborative access.

```bash
# List all teams
curl -X GET "https://app.coolify.io/api/v1/teams" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get current team
curl -X GET "https://app.coolify.io/api/v1/teams/current" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# List current team members
curl -X GET "https://app.coolify.io/api/v1/teams/current/members" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get specific team details
curl -X GET "https://app.coolify.io/api/v1/teams/team-id-here" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Health and Version Endpoints

Check API health and Coolify version.

```bash
# Health check (no auth required)
curl -X GET "https://app.coolify.io/api/health"
# Response: "OK"

# Get Coolify version (no auth required)
curl -X GET "https://app.coolify.io/api/v1/version"
# Response: { "version": "4.0.0-beta.xxx" }

# Enable API
curl -X GET "https://app.coolify.io/api/v1/enable" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Disable API
curl -X GET "https://app.coolify.io/api/v1/disable" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## Manual Installation

For advanced users who prefer manual setup or when the automatic script doesn't work.

```bash
# 1. Create required directories
mkdir -p /data/coolify/{source,ssh,applications,databases,backups,services,proxy,webhooks-during-maintenance}
mkdir -p /data/coolify/ssh/{keys,mux}
mkdir -p /data/coolify/proxy/dynamic

# 2. Generate SSH key for server management
ssh-keygen -f /data/coolify/ssh/keys/id.root@host.docker.internal -t ed25519 -N '' -C root@coolify
cat /data/coolify/ssh/keys/id.root@host.docker.internal.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 3. Download configuration files
curl -fsSL https://cdn.coollabs.io/coolify/docker-compose.yml -o /data/coolify/source/docker-compose.yml
curl -fsSL https://cdn.coollabs.io/coolify/docker-compose.prod.yml -o /data/coolify/source/docker-compose.prod.yml
curl -fsSL https://cdn.coollabs.io/coolify/.env.production -o /data/coolify/source/.env
curl -fsSL https://cdn.coollabs.io/coolify/upgrade.sh -o /data/coolify/source/upgrade.sh

# 4. Set permissions
chown -R 9999:root /data/coolify
chmod -R 700 /data/coolify

# 5. Generate secure values
sed -i "s|APP_ID=.*|APP_ID=$(openssl rand -hex 16)|g" /data/coolify/source/.env
sed -i "s|APP_KEY=.*|APP_KEY=base64:$(openssl rand -base64 32)|g" /data/coolify/source/.env
sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -base64 32)|g" /data/coolify/source/.env
sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$(openssl rand -base64 32)|g" /data/coolify/source/.env
sed -i "s|PUSHER_APP_ID=.*|PUSHER_APP_ID=$(openssl rand -hex 32)|g" /data/coolify/source/.env
sed -i "s|PUSHER_APP_KEY=.*|PUSHER_APP_KEY=$(openssl rand -hex 32)|g" /data/coolify/source/.env
sed -i "s|PUSHER_APP_SECRET=.*|PUSHER_APP_SECRET=$(openssl rand -hex 32)|g" /data/coolify/source/.env

# 6. Create Docker network
docker network create --attachable coolify

# 7. Start Coolify
docker compose --env-file /data/coolify/source/.env \
  -f /data/coolify/source/docker-compose.yml \
  -f /data/coolify/source/docker-compose.prod.yml \
  up -d --pull always --remove-orphans --force-recreate

# Access Coolify at http://<server-ip>:8000
```

Coolify's primary use cases include deploying web applications from Git repositories with automatic CI/CD pipelines, hosting databases with automated backups, and running self-hosted alternatives to popular SaaS tools through its one-click service templates. The platform excels at managing multiple applications across different environments (production, staging, development) on single or multiple servers, making it ideal for individual developers, small teams, and organizations looking to reduce cloud costs while maintaining full control over their infrastructure.

Integration with Coolify typically follows the pattern of creating projects to organize resources, connecting servers via SSH, then deploying applications and services through either the web dashboard or API. The API enables automation workflows such as triggering deployments from CI/CD pipelines (GitHub Actions, GitLab CI), managing environment variables programmatically, and building custom dashboards or monitoring solutions. Coolify's webhook support allows for advanced integrations with external services, while its team and permission system enables collaborative development workflows with granular access control.
