# 3DTech Production Deployment

Production deployment is performed from the VPS using the managed deployment command.

## Check for updates

deploy-3dtech --check

## Deploy a normal application update

deploy-3dtech

## Database schema changes

Releases that modify server/db.js require explicit review before deployment:

deploy-3dtech --allow-db-change

The deployment process validates Git state, tests and builds the candidate release, creates a consistent SQLite backup, performs a fast-forward deployment, restarts only the main 3dtech process, and verifies local and public health.

Production secrets and .env values must never be committed to Git.
