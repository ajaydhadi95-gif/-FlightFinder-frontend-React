# Frontend Deployment Runbook

## 1. Objective

Deploy the React/Vite frontend application to an **Amazon EKS cluster** using:

```text
Developer
   ↓
GitHub Repository
   ↓
Jenkins Pipeline
   ↓
Docker Build
   ↓
Docker Hub
   ↓
Amazon EKS
   ↓
Kubernetes Service
   ↓
AWS Load Balancer
   ↓
End User
```

---

# 2. Environment Details

| Component             | Configuration                       |
| --------------------- | ----------------------------------- |
| AWS Region            | `ap-south-1`                        |
| EKS Cluster           | `devops-eks`                        |
| Kubernetes Version    | `1.34`                              |
| Frontend Repository   | `FlightFinder-Application_frontend` |
| Git Branch            | `main`                              |
| Docker Image          | `ajaydhadi95/booking_frontend`      |
| Container             | Nginx                               |
| Container Port        | `80`                                |
| Kubernetes Deployment | `booking-frontend`                  |
| Kubernetes Service    | `booking-frontend-service`          |
| Service Type          | `LoadBalancer`                      |

---

# 3. Prerequisites

The Jenkins server should have:

```text
Git
Docker
AWS CLI
kubectl
Java
Maven (if required by pipeline)
Terraform
```

Verify:

```bash
git --version
docker --version
aws --version
kubectl version --client
java -version
terraform --version
```

### Purpose

These commands verify that all required tools are available before starting the deployment.

---

# 4. Verify AWS Identity

Run:

```bash
aws sts get-caller-identity
```

### Purpose

This verifies which AWS IAM user/role Jenkins is using.

Expected result should show the AWS account and IAM identity.

For our setup Jenkins uses:

```text
terraform-ssm-role
```

---

# 5. Verify EKS Cluster

Configure kubectl:

```bash
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name devops-eks
```

### Purpose

This creates/updates the kubeconfig entry so `kubectl` can communicate with the EKS cluster.

---

Check cluster connectivity:

```bash
kubectl get nodes
```

### Purpose

Confirms that:

* EKS cluster is accessible
* IAM authentication works
* Kubernetes API is reachable
* Worker nodes are registered

Example:

```text
NAME                                             STATUS   ROLES    AGE
ip-10-0-11-xxx.ap-south-1.compute.internal     Ready    <none>   ...
ip-10-0-12-xxx.ap-south-1.compute.internal     Ready    <none>   ...
```

---

# 6. Frontend Project Structure

The frontend project contains the React/Vite application.

Important files:

```text
FlightFinder-Application_frontend/
│
├── package.json
├── package-lock.json
├── src/
├── public/
├── Dockerfile
├── nginx.conf
└── ...
```

---

# 7. Frontend Dockerfile

The frontend uses a multi-stage Docker build.

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## Purpose

### Stage 1 — Build React application

```dockerfile
FROM node:22-alpine AS builder
```

Provides Node.js for building the frontend.

```dockerfile
WORKDIR /app
```

Sets the working directory.

```dockerfile
COPY package*.json ./
```

Copies npm dependency files.

```dockerfile
RUN npm ci
```

Installs dependencies from `package-lock.json`.

```dockerfile
COPY . .
```

Copies the frontend source code.

```dockerfile
RUN npm run build
```

Creates the production build inside:

```text
/app/dist
```

### Stage 2 — Nginx

```dockerfile
FROM nginx:alpine
```

Uses lightweight Nginx to serve the frontend.

```dockerfile
COPY --from=builder /app/dist /usr/share/nginx/html
```

Copies the React production build into the Nginx web directory.

```dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Copies our custom Nginx configuration.

---

# 8. Nginx Configuration

Our Nginx configuration was used to:

* Serve the React application
* Support React/Vite routes
* Forward `/api/` requests to the backend

Example structure:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://BACKEND_PRIVATE_IP:8080;
    }
}
```

### Purpose

```nginx
try_files $uri /index.html;
```

is important for React routing.

The `/api/` block forwards frontend API requests toward the backend.

> In our current architecture the backend is private, so the frontend should not directly expose the backend private IP to the internet. The final production design should route API traffic through an appropriate internal/reverse-proxy/load-balancer architecture.

---

# 9. Test Frontend Locally

Before Docker deployment, test the application:

```bash
npm install
```

Purpose:

Install frontend dependencies.

Run development server:

```bash
npm run dev
```

Purpose:

Start the Vite development server for local testing.

Build production version:

```bash
npm run build
```

Purpose:

Verify that the production build succeeds.

---

# 10. Build Docker Image

From the frontend project directory:

```bash
docker build -t ajaydhadi95/booking_frontend:latest .
```

### Purpose

Builds the Docker image containing:

```text
React application
+
Nginx
+
Nginx configuration
```

Check image:

```bash
docker images
```

---

# 11. Test Docker Container Locally

Run:

```bash
docker run -d \
  --name booking-frontend \
  -p 8080:80 \
  ajaydhadi95/booking_frontend:latest
```

### Purpose

Maps:

```text
localhost:8080
       ↓
container:80
```

Check container:

```bash
docker ps
```

Test:

```text
http://localhost:8080
```

Stop container:

```bash
docker stop booking-frontend
```

Remove container:

```bash
docker rm booking-frontend
```

---

# 12. Docker Hub Login

Jenkins uses a Docker Hub credential.

Manual login command:

```bash
docker login
```

For Jenkins, the recommended method is to store Docker Hub credentials in:

```text
Jenkins → Manage Jenkins → Credentials
```

Credential ID used in our pipeline:

```text
dockerhub-credentials
```

### Purpose

Allows Jenkins to push the Docker image to Docker Hub.

---

# 13. Push Docker Image

Build:

```bash
docker build -t ajaydhadi95/booking_frontend:latest .
```

Push:

```bash
docker push ajaydhadi95/booking_frontend:latest
```

### Purpose

Uploads the frontend image to Docker Hub.

EKS can then pull:

```text
ajaydhadi95/booking_frontend:latest
```

---

# 14. Jenkins Pipeline

Our frontend deployment pipeline follows:

```text
Checkout
   ↓
Verify Project
   ↓
Build Docker Image
   ↓
Push Docker Image
   ↓
Connect to EKS
   ↓
Deploy to EKS
   ↓
Rollout Status
   ↓
Create/Update LoadBalancer Service
```

---

# 15. Jenkins Checkout

The pipeline checks out:

```text
Repository:
FlightFinder-Application_frontend

Branch:
main
```

### Purpose

Downloads the latest frontend source code from GitHub into the Jenkins workspace.

---

# 16. Verify Project

The pipeline verifies files such as:

```bash
ls -la
```

and can verify:

```bash
cat package.json
cat Dockerfile
cat nginx.conf
```

### Purpose

Confirms Jenkins received the expected frontend project files.

---

# 17. Jenkins Docker Build

Pipeline command:

```bash
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
```

Example:

```text
ajaydhadi95/booking_frontend:latest
```

### Purpose

Creates the frontend production Docker image.

---

# 18. Jenkins Push to Docker Hub

Pipeline:

```bash
docker push ${IMAGE_NAME}:${IMAGE_TAG}
```

Example:

```bash
docker push ajaydhadi95/booking_frontend:latest
```

### Purpose

Makes the image available for EKS worker nodes.

---

# 19. Jenkins Connects to EKS

Pipeline uses:

```bash
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name devops-eks
```

Then:

```bash
kubectl get nodes
```

### Purpose

Confirms Jenkins can authenticate with EKS before deploying.

---

# 20. Create/Update Kubernetes Deployment

The deployment command used was based on:

```bash
kubectl create deployment booking-frontend \
  --image=ajaydhadi95/booking_frontend:latest \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Purpose

Creates the Kubernetes Deployment if it does not exist.

If it already exists, `kubectl apply` updates it.

---

# 21. Verify Container Name

We encountered a deployment issue related to the container name.

To dynamically obtain the container name:

```bash
CONTAINER_NAME=$(kubectl get deployment booking-frontend \
  -o jsonpath='{.spec.template.spec.containers[0].name}')
```

### Purpose

Avoids hard-coding a container name that may not match the deployment specification.

---

# 22. Update Docker Image

Command:

```bash
kubectl set image deployment/booking-frontend \
  ${CONTAINER_NAME}=ajaydhadi95/booking_frontend:latest
```

### Purpose

Updates the Kubernetes deployment to use the latest Docker image.

---

# 23. Check Deployment Rollout

Command:

```bash
kubectl rollout status deployment/booking-frontend --timeout=180s
```

### Purpose

Waits until Kubernetes successfully rolls out the new frontend version.

Successful output indicates the deployment completed.

---

# 24. Create LoadBalancer Service

Command:

```bash
kubectl expose deployment booking-frontend \
  --name=booking-frontend-service \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Purpose

Creates a Kubernetes Service of type:

```text
LoadBalancer
```

AWS then provisions an AWS Load Balancer for the frontend.

Traffic flow:

```text
Internet
   ↓
AWS Load Balancer
   ↓
Kubernetes Service :80
   ↓
Frontend Pod :80
   ↓
Nginx
   ↓
React Application
```

---

# 25. Check Deployment

```bash
kubectl get deployments
```

Expected:

```text
booking-frontend
```

---

# 26. Check Pods

```bash
kubectl get pods -o wide
```

Purpose:

Check:

* Pod status
* Pod IP
* Node
* Ready state
* Restart count

Expected:

```text
STATUS: Running
READY: 1/1
```

---

# 27. Check Service

```bash
kubectl get svc booking-frontend-service
```

Expected:

```text
TYPE           LoadBalancer
PORT(S)        80:xxxxx/TCP
EXTERNAL-IP    AWS Load Balancer hostname
```

We received an AWS Load Balancer hostname for the frontend service.

---

# 28. Check All Kubernetes Resources

Useful command:

```bash
kubectl get all
```

Or:

```bash
kubectl get deployment,pods,svc
```

Purpose:

Provides a quick overview of the frontend deployment.

---

# 29. Troubleshooting Commands

## Check Pod

```bash
kubectl get pods
```

## Detailed Pod Information

```bash
kubectl describe pod <POD_NAME>
```

## Pod Logs

```bash
kubectl logs <POD_NAME>
```

## Deployment Details

```bash
kubectl describe deployment booking-frontend
```

## Service Details

```bash
kubectl describe svc booking-frontend-service
```

## Check Events

```bash
kubectl get events --sort-by=.lastTimestamp
```

---

# 30. Common Problems We Addressed

### Problem 1 — Container name mismatch

Deployment command attempted to update a container that Kubernetes could not find.

Error:

```text
unable to find container named ...
```

Solution:

```bash
CONTAINER_NAME=$(kubectl get deployment booking-frontend \
  -o jsonpath='{.spec.template.spec.containers[0].name}')
```

Then:

```bash
kubectl set image deployment/booking-frontend \
  ${CONTAINER_NAME}=ajaydhadi95/booking_frontend:latest
```

---

### Problem 2 — Verify EKS access

Before deployment:

```bash
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name devops-eks
```

Then:

```bash
kubectl get nodes
```

This confirms Jenkins has EKS access.

---

### Problem 3 — Verify Pod

```bash
kubectl get pods -o wide
```

The frontend pod successfully reached:

```text
Running
```

---

### Problem 4 — Verify LoadBalancer

```bash
kubectl get svc booking-frontend-service
```

The service was configured as:

```text
LoadBalancer
```

AWS then provided an external Load Balancer hostname.

---

# 31. Complete Deployment Command Sequence

For quick reference:

```bash
# 1. Verify AWS
aws sts get-caller-identity

# 2. Connect kubectl to EKS
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name devops-eks

# 3. Verify EKS
kubectl get nodes

# 4. Build Docker image
docker build -t ajaydhadi95/booking_frontend:latest .

# 5. Push Docker image
docker push ajaydhadi95/booking_frontend:latest

# 6. Create/update deployment
kubectl create deployment booking-frontend \
  --image=ajaydhadi95/booking_frontend:latest \
  --dry-run=client -o yaml | kubectl apply -f -

# 7. Get container name
CONTAINER_NAME=$(kubectl get deployment booking-frontend \
  -o jsonpath='{.spec.template.spec.containers[0].name}')

# 8. Update image
kubectl set image deployment/booking-frontend \
  ${CONTAINER_NAME}=ajaydhadi95/booking_frontend:latest

# 9. Wait for rollout
kubectl rollout status deployment/booking-frontend --timeout=180s

# 10. Create/update LoadBalancer
kubectl expose deployment booking-frontend \
  --name=booking-frontend-service \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  --dry-run=client -o yaml | kubectl apply -f -

# 11. Verify
kubectl get deployment
kubectl get pods -o wide
kubectl get svc booking-frontend-service
```

---

# 32. Final Architecture

```text
                    USER
                      │
                      │ HTTP
                      ▼
             AWS Load Balancer
                      │
                      ▼
        booking-frontend-service
             Kubernetes Service
                      │
                      ▼
          ┌─────────────────────┐
          │   EKS Cluster       │
          │   devops-eks        │
          │                     │
          │  Frontend Pod       │
          │  Nginx :80          │
          │       │             │
          │       ▼             │
          │  React Application   │
          └─────────────────────┘
                      ▲
                      │
                 Docker Image
                      │
                      │
                Docker Hub
                      ▲
                      │
                 Jenkins
                      ▲
                      │
                   GitHub
```

---

# 33. Deployment Verification Checklist

Before declaring deployment successful:

```text
[✓] GitHub repository accessible
[✓] Jenkins checkout successful
[✓] Docker build successful
[✓] Docker image pushed to Docker Hub
[✓] Jenkins can access AWS
[✓] Jenkins can access EKS
[✓] EKS nodes are Ready
[✓] Kubernetes Deployment created
[✓] Frontend Pod Running
[✓] Rollout successful
[✓] LoadBalancer Service created
[✓] External LoadBalancer hostname assigned
[✓] Frontend accessible through LoadBalancer
```

---
# Jenkins to EKS Kubeconfig Setup

## 1. Purpose

Jenkins needs access to the Amazon EKS cluster to execute Kubernetes commands such as:

```bash
kubectl get nodes
kubectl get pods
kubectl apply
kubectl set image
kubectl rollout status
```

During the setup, we found that:

* The **Ubuntu user** had the correct EKS kubeconfig.
* The **Jenkins user** did not have a kubeconfig under `/var/lib/jenkins/.kube/`.
* Therefore, Jenkins could not access the EKS cluster using `kubectl`.

We fixed this by copying the working kubeconfig to the Jenkins user's `.kube` directory and assigning the correct permissions.

---

# 2. Verify Ubuntu User Kubeconfig

First, we verified the Kubernetes configuration for the Ubuntu user:

```bash
kubectl config view --minify
```

### Purpose

This verifies the currently active Kubernetes context and confirms that the Ubuntu user has a valid EKS kubeconfig.

---

# 3. Check Jenkins Kubeconfig

We checked whether Jenkins had its own Kubernetes configuration:

```bash
sudo -u jenkins ls -la /var/lib/jenkins/.kube/
```

We also checked the Kubernetes configuration as the Jenkins user:

```bash
sudo -u jenkins kubectl config view --minify
```

### Result

The Jenkins user's kubeconfig was missing.

Therefore, Jenkins could not use `kubectl` to communicate with the EKS cluster.

---

# 4. Create Jenkins Kubernetes Directory

Create the `.kube` directory for Jenkins:

```bash
sudo mkdir -p /var/lib/jenkins/.kube
```

### Purpose

Creates the directory where the Jenkins user's Kubernetes configuration will be stored.

Directory:

```text
/var/lib/jenkins/.kube/
```

---

# 5. Copy the EKS Kubeconfig

Copy the working Ubuntu kubeconfig to the Jenkins user's directory:

```bash
sudo cp /home/ubuntu/.kube/config /var/lib/jenkins/.kube/config
```

### Purpose

This gives Jenkins access to the same EKS cluster configuration that was already working for the Ubuntu user.

Flow:

```text
Ubuntu User
/home/ubuntu/.kube/config
          |
          | Copy
          v
Jenkins User
/var/lib/jenkins/.kube/config
```

---

# 6. Change File Ownership

Assign ownership of the Kubernetes configuration to Jenkins:

```bash
sudo chown -R jenkins:jenkins /var/lib/jenkins/.kube
```

### Purpose

Ensures that the Jenkins user can read and use the kubeconfig file.

---

# 7. Secure the Kubernetes Directory

Set directory permissions:

```bash
sudo chmod 700 /var/lib/jenkins/.kube
```

### Purpose

Allows only the Jenkins user to access the `.kube` directory.

---

# 8. Secure the Kubeconfig File

Set the kubeconfig file permissions:

```bash
sudo chmod 600 /var/lib/jenkins/.kube/config
```

### Purpose

Allows only the Jenkins user to read and modify the kubeconfig file.

Expected permission:

```text
-rw------- jenkins jenkins config
```

---

# 9. Test Jenkins to EKS Connectivity

Now we tested EKS access specifically as the Jenkins user:

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get nodes
```

### Purpose

This verifies that the Jenkins user can authenticate to the EKS cluster and retrieve worker nodes.

Expected output:

```text
NAME                                             STATUS
ip-10-0-11-209.ap-south-1.compute.internal     Ready
ip-10-0-12-19.ap-south-1.compute.internal       Ready
```

### Result

Both EKS worker nodes were in:

```text
Ready
```

This confirmed that Jenkins could successfully communicate with the EKS cluster.

---

# 10. Verify Kubernetes Pod Access

We also tested Kubernetes resource access:

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get pods -A
```

### Purpose

The `-A` option means **all namespaces**.

This confirms that Jenkins can access Kubernetes resources, not just the EKS nodes.

---

# 11. Verify Jenkins Kubernetes Context

We verified the active Kubernetes context from the Jenkins user:

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl config view --minify
```

### Purpose

Confirms that Jenkins is using the expected EKS cluster and Kubernetes context.

---

# 12. Configure Jenkins Pipeline

The Jenkins pipeline can explicitly use the Jenkins kubeconfig:

```bash
export KUBECONFIG=/var/lib/jenkins/.kube/config
```

For example:

```groovy
stage('Connect to EKS') {
    steps {
        sh '''
            export KUBECONFIG=/var/lib/jenkins/.kube/config

            kubectl get nodes
            kubectl get pods -A
        '''
    }
}
```

### Purpose

This ensures that every `kubectl` command executed by the Jenkins pipeline uses:

```text
/var/lib/jenkins/.kube/config
```

---

# 13. Complete Jenkins EKS Verification

Use the following commands whenever Jenkins-to-EKS connectivity needs to be verified:

### Check kubeconfig directory

```bash
sudo -u jenkins ls -la /var/lib/jenkins/.kube/
```

### Check Kubernetes context

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl config view --minify
```

### Check EKS nodes

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get nodes
```

### Check Kubernetes pods

```bash
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get pods -A
```

---

# 14. Final Verification

After completing the configuration, the following conditions were confirmed:

```text
✓ Ubuntu user had a working EKS kubeconfig
✓ Jenkins .kube directory was created
✓ EKS kubeconfig was copied to Jenkins
✓ Jenkins ownership was configured
✓ .kube directory permissions were secured
✓ kubeconfig file permissions were secured
✓ Jenkins could authenticate to EKS
✓ EKS worker nodes were visible to Jenkins
✓ EKS worker nodes were Ready
✓ Jenkins could access Kubernetes pods
✓ Jenkins was ready to deploy the frontend to EKS
```

---

# 15. Role in the Frontend Deployment

This setup was an important prerequisite for the frontend CI/CD pipeline.

The complete deployment flow was:

```text
GitHub
   |
   v
Jenkins
   |
   +--> Checkout Frontend
   |
   +--> Build Docker Image
   |
   +--> Push Image to Docker Hub
   |
   +--> Configure KUBECONFIG
   |       |
   |       v
   |   /var/lib/jenkins/.kube/config
   |       |
   |       v
   |   Amazon EKS
   |
   +--> Create/Update Frontend Deployment
   |
   +--> Update Docker Image
   |
   +--> Rollout Status
   |
   +--> Kubernetes LoadBalancer Service
   |
   v
AWS Load Balancer
   |
   v
End User
```

## Key Commands Used

```bash
# Check Ubuntu EKS configuration
kubectl config view --minify

# Check Jenkins kubeconfig
sudo -u jenkins ls -la /var/lib/jenkins/.kube/

# Create Jenkins kube directory
sudo mkdir -p /var/lib/jenkins/.kube

# Copy kubeconfig
sudo cp /home/ubuntu/.kube/config /var/lib/jenkins/.kube/config

# Set Jenkins ownership
sudo chown -R jenkins:jenkins /var/lib/jenkins/.kube

# Secure directory
sudo chmod 700 /var/lib/jenkins/.kube

# Secure kubeconfig
sudo chmod 600 /var/lib/jenkins/.kube/config

# Test Jenkins → EKS connectivity
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get nodes

# Test Kubernetes access
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl get pods -A

# Verify Jenkins Kubernetes context
sudo -u jenkins env KUBECONFIG=/var/lib/jenkins/.kube/config kubectl config view --minify
```



---
# 34. One-Line Interview Explanation

> "We implemented a CI/CD-based frontend deployment where Jenkins checks out the React application from GitHub, builds a multi-stage Docker image using Node and Nginx, pushes the image to Docker Hub, authenticates with Amazon EKS, deploys the application using a Kubernetes Deployment, and exposes it through a LoadBalancer Service backed by an AWS Load Balancer."
