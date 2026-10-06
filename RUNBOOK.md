\# FlightFinder Frontend



\## AWS + Jenkins + Docker + Docker Hub CI/CD Deployment Runbook



\---



\## 1. Purpose



This runbook explains how to build, containerize, push, and deploy the \*\*FlightFinder React frontend\*\* using:



\* GitHub

\* Jenkins

\* Docker

\* Docker Hub

\* AWS EC2

\* Nginx

\* SSH



The objective is to automate frontend deployment so that Jenkins can build a new Docker image and deploy it to the frontend EC2 server.



\---



\# 2. Architecture



```text

Developer

&#x20;   |

&#x20;   | Git Push

&#x20;   ↓

GitHub

&#x20;   |

&#x20;   ↓

Jenkins EC2

&#x20;   |

&#x20;   | Checkout

&#x20;   | Docker Build

&#x20;   | Docker Push

&#x20;   ↓

Docker Hub

&#x20;   |

&#x20;   | Docker Pull

&#x20;   ↓

Frontend EC2

&#x20;   |

&#x20;   ↓

Docker Container

&#x20;   |

&#x20;   ↓

Nginx

&#x20;   |

&#x20;   ↓

React Application

&#x20;   |

&#x20;   ↓

Port 80

```



\---



\# 3. Project Components



| Component  | Purpose                      |

| ---------- | ---------------------------- |

| GitHub     | Source code repository       |

| Jenkins    | CI/CD automation             |

| Docker     | Application containerization |

| Docker Hub | Docker image registry        |

| AWS EC2    | Frontend deployment server   |

| Nginx      | Production web server        |

| SSH        | Jenkins-to-EC2 communication |

| React/Vite | Frontend application         |



\---



\# 4. Environment Details



\### Frontend Repository



```text

https://github.com/ajaydhadi95-gif/-FlightFinder-frontend-React.git

```



Branch:



```text

main

```



\### Docker Image



```text

ajaydhadi95/flightfinder-frontend

```



Example:



```text

ajaydhadi95/flightfinder-frontend:4

```



\### Frontend EC2



Public IP:



```text

13.200.254.41

```



Private IP:



```text

10.0.1.233

```



Application URL:



```text

http://13.200.254.41

```



\### Application Port



```text

80

```



\---



\# 5. Prerequisites



\## 5.1 Jenkins EC2



The Jenkins server should have:



```text

Java 21

Git

Docker

AWS CLI

Jenkins

```



Verify:



```bash

java -version

```



```bash

git --version

```



```bash

docker --version

```



```bash

aws --version

```



Check Jenkins:



```bash

sudo systemctl status jenkins

```



Jenkins should be:



```text

active (running)

```



\---



\# 6. Verify Docker Access from Jenkins



Jenkins must be able to execute Docker commands.



Run:



```bash

sudo -u jenkins docker ps

```



If Docker information is displayed, Jenkins can access Docker.



If permission is denied:



```bash

sudo usermod -aG docker jenkins

```



Restart Jenkins:



```bash

sudo systemctl restart jenkins

```



Then verify again:



```bash

sudo -u jenkins docker ps

```



\---



\# 7. Frontend EC2 Setup



The frontend EC2 instance should have Docker installed.



Verify:



```bash

docker --version

```



Check Docker:



```bash

sudo systemctl status docker

```



Enable Docker:



```bash

sudo systemctl enable docker

```



Start Docker:



```bash

sudo systemctl start docker

```



\---



\# 8. Frontend Security Group



The frontend EC2 security group should allow:



| Protocol | Port | Source                      | Purpose           |

| -------- | ---: | --------------------------- | ----------------- |

| SSH      |   22 | Jenkins/network as required | Remote deployment |

| HTTP     |   80 | Internet                    | Website access    |



For production, SSH should preferably be restricted to the Jenkins server's network/security design rather than allowing the entire internet.



\---



\# 9. Dockerfile



The project uses a multi-stage Dockerfile.



```dockerfile

\# Build stage

FROM node:22-alpine AS build



WORKDIR /app



COPY package\*.json ./



RUN npm ci



COPY . .



RUN npm run build



\# Production stage

FROM nginx:alpine



COPY --from=build /app/dist /usr/share/nginx/html



EXPOSE 80



CMD \["nginx", "-g", "daemon off;"]

```



\---



\# 10. Dockerfile Explanation



\## Build Stage



```dockerfile

FROM node:22-alpine AS build

```



Uses Node.js to build the React application.



```dockerfile

WORKDIR /app

```



Creates the application working directory.



```dockerfile

COPY package\*.json ./

```



Copies package files.



```dockerfile

RUN npm ci

```



Installs the required dependencies.



```dockerfile

COPY . .

```



Copies the application source code.



```dockerfile

RUN npm run build

```



Creates the production React build.



The output is:



```text

dist/

```



\---



\## Production Stage



```dockerfile

FROM nginx:alpine

```



Uses lightweight Nginx.



```dockerfile

COPY --from=build /app/dist /usr/share/nginx/html

```



Copies the React production files into the Nginx web directory.



```dockerfile

EXPOSE 80

```



Documents that the application uses port 80.



```dockerfile

CMD \["nginx", "-g", "daemon off;"]

```



Runs Nginx in the foreground so Docker can manage the process.



\---



\# 11. .dockerignore



Recommended `.dockerignore`:



```text

node\_modules

dist

.git

.gitignore

README.md

Dockerfile

.dockerignore

```



This prevents unnecessary files from being copied into the Docker build context.



\---



\# 12. Jenkins Credentials



Two Jenkins credentials are required.



\## Credential 1 – Docker Hub



Credential ID:



```text

dockerhub-credentials

```



Type:



```text

Username with password

```



Username:



```text

ajaydhadi95

```



Password:



```text

Docker Hub Access Token

```



Do not store or expose the Docker Hub password directly inside the Jenkinsfile.



\---



\# 13. Credential 2 – Frontend EC2 SSH



Credential ID:



```text

frontend-ec2-ssh

```



Type:



```text

SSH Username with private key

```



Username:



```text

ubuntu

```



The private key should be stored securely inside Jenkins Credentials.



Never put the private SSH key directly inside the Jenkinsfile or GitHub repository.



\---



\# 14. SSH Configuration



Jenkins generates an SSH key pair:



```bash

ssh-keygen -t ed25519 -C "jenkins-frontend-deploy"

```



The key files are:



```text

\~/.ssh/id\_ed25519

\~/.ssh/id\_ed25519.pub

```



The public key is added to the frontend EC2:



```text

\~/.ssh/authorized\_keys

```



The private key is stored in Jenkins credentials.



\---



\# 15. Test SSH Before Jenkins Deployment



From Jenkins EC2:



```bash

ssh -i \~/.ssh/id\_ed25519 ubuntu@13.200.254.41

```



If SSH works, Jenkins should be able to connect using the same key.



This test is important before troubleshooting the Jenkins pipeline.



\---



\# 16. Jenkins Pipeline



Use the following Jenkinsfile:



```groovy

pipeline {



&#x20;   agent any



&#x20;   environment {

&#x20;       IMAGE\_NAME = 'ajaydhadi95/flightfinder-frontend'

&#x20;       IMAGE\_TAG  = "${BUILD\_NUMBER}"

&#x20;       FRONTEND\_EC2 = '13.200.254.41'

&#x20;   }



&#x20;   stages {



&#x20;       stage('Checkout') {

&#x20;           steps {

&#x20;               git branch: 'main',

&#x20;                   url: 'https://github.com/ajaydhadi95-gif/-FlightFinder-frontend-React.git'

&#x20;           }

&#x20;       }



&#x20;       stage('Docker Build') {

&#x20;           steps {

&#x20;               sh "docker build -t ${IMAGE\_NAME}:${IMAGE\_TAG} ."

&#x20;               sh "docker tag ${IMAGE\_NAME}:${IMAGE\_TAG} ${IMAGE\_NAME}:latest"

&#x20;           }

&#x20;       }



&#x20;       stage('Docker Push') {

&#x20;           steps {

&#x20;               withCredentials(\[

&#x20;                   usernamePassword(

&#x20;                       credentialsId: 'dockerhub-credentials',

&#x20;                       usernameVariable: 'DOCKER\_USERNAME',

&#x20;                       passwordVariable: 'DOCKER\_PASSWORD'

&#x20;                   )

&#x20;               ]) {

&#x20;                   sh '''

&#x20;                       echo "$DOCKER\_PASSWORD" | docker login \\

&#x20;                       -u "$DOCKER\_USERNAME" \\

&#x20;                       --password-stdin

&#x20;                   '''



&#x20;                   sh "docker push ${IMAGE\_NAME}:${IMAGE\_TAG}"

&#x20;                   sh "docker push ${IMAGE\_NAME}:latest"

&#x20;               }

&#x20;           }

&#x20;       }



&#x20;       stage('Deploy to Frontend EC2') {

&#x20;           steps {

&#x20;               withCredentials(\[

&#x20;                   sshUserPrivateKey(

&#x20;                       credentialsId: 'frontend-ec2-ssh',

&#x20;                       keyFileVariable: 'SSH\_KEY',

&#x20;                       usernameVariable: 'SSH\_USER'

&#x20;                   )

&#x20;               ]) {

&#x20;                   sh """

&#x20;                       ssh -o StrictHostKeyChecking=no \\

&#x20;                           -i "\\$SSH\_KEY" \\

&#x20;                           "\\$SSH\_USER@${FRONTEND\_EC2}" '

&#x20;                           

&#x20;                           docker pull ${IMAGE\_NAME}:${IMAGE\_TAG}



&#x20;                           docker stop flightfinder-frontend || true



&#x20;                           docker rm flightfinder-frontend || true



&#x20;                           docker run -d \\

&#x20;                               --restart unless-stopped \\

&#x20;                               --name flightfinder-frontend \\

&#x20;                               -p 80:80 \\

&#x20;                               ${IMAGE\_NAME}:${IMAGE\_TAG}



&#x20;                           docker ps

&#x20;                       '

&#x20;                   """

&#x20;               }

&#x20;           }

&#x20;       }

&#x20;   }



&#x20;   post {



&#x20;       success {

&#x20;           echo 'FlightFinder Frontend deployed successfully!'

&#x20;       }



&#x20;       failure {

&#x20;           echo 'FlightFinder Frontend deployment failed!'

&#x20;       }

&#x20;   }

}

```



\---



\# 17. Pipeline Stage 1 – Checkout



Jenkins checks out the code from GitHub.



```text

GitHub

&#x20;  ↓

Jenkins Workspace

```



The important configuration is:



```groovy

git branch: 'main',

&#x20;   url: 'https://github.com/ajaydhadi95-gif/-FlightFinder-frontend-React.git'

```



\---



\# 18. Pipeline Stage 2 – Docker Build



Jenkins builds the Docker image:



```bash

docker build -t ajaydhadi95/flightfinder-frontend:${BUILD\_NUMBER} .

```



For Build #4:



```text

ajaydhadi95/flightfinder-frontend:4

```



The image is also tagged as:



```text

ajaydhadi95/flightfinder-frontend:latest

```



\---



\# 19. Pipeline Stage 3 – Docker Push



Jenkins logs in to Docker Hub:



```bash

echo "$DOCKER\_PASSWORD" | docker login \\

\-u "$DOCKER\_USERNAME" \\

\--password-stdin

```



Then pushes:



```bash

docker push ajaydhadi95/flightfinder-frontend:4

```



and:



```bash

docker push ajaydhadi95/flightfinder-frontend:latest

```



\---



\# 20. Pipeline Stage 4 – Deployment



Jenkins connects to the frontend EC2 using SSH.



```text

Jenkins EC2

&#x20;    |

&#x20;    | SSH

&#x20;    ↓

Frontend EC2

```



Then it pulls the new image:



```bash

docker pull ajaydhadi95/flightfinder-frontend:4

```



Stops the old container:



```bash

docker stop flightfinder-frontend || true

```



Removes it:



```bash

docker rm flightfinder-frontend || true

```



Starts the new container:



```bash

docker run -d \\

&#x20;   --restart unless-stopped \\

&#x20;   --name flightfinder-frontend \\

&#x20;   -p 80:80 \\

&#x20;   ajaydhadi95/flightfinder-frontend:4

```



\---



\# 21. Verify Deployment



SSH into the frontend EC2:



```bash

ssh ubuntu@13.200.254.41

```



Check running containers:



```bash

docker ps

```



Expected:



```text

flightfinder-frontend

```



Check port mapping:



```text

0.0.0.0:80->80/tcp

```



\---



\# 22. Check Docker Image



Run:



```bash

docker images

```



Expected:



```text

ajaydhadi95/flightfinder-frontend

```



You should see the build-number tag:



```text

4

```



and:



```text

latest

```



\---



\# 23. Check Container Logs



Run:



```bash

docker logs flightfinder-frontend

```



For real-time logs:



```bash

docker logs -f flightfinder-frontend

```



\---



\# 24. Test the Application



Open the browser:



```text

http://13.200.254.41

```



Expected result:



```text

FlightFinder React Application

```



If the application loads successfully, the frontend deployment is complete.



\---



\# 25. Troubleshooting



\## Problem 1 – Jenkins Cannot Run Docker



Error:



```text

permission denied while trying to connect to the Docker daemon

```



Check:



```bash

sudo -u jenkins docker ps

```



Fix:



```bash

sudo usermod -aG docker jenkins

```



Restart:



```bash

sudo systemctl restart jenkins

```



Test again:



```bash

sudo -u jenkins docker ps

```



\---



\# 26. Problem 2 – SSH Public Key Error



Error:



```text

Permission denied (publickey)

```



Check:



```bash

ssh -i \~/.ssh/id\_ed25519 ubuntu@13.200.254.41

```



Verify that the public key exists on the frontend EC2:



```bash

cat \~/.ssh/authorized\_keys

```



Verify the Jenkins credential:



```text

frontend-ec2-ssh

```



Make sure the complete private key is stored correctly.



\---



\# 27. Problem 3 – libcrypto Error



Error:



```text

Load key "\*\*\*\*": error in libcrypto

```



Possible cause:



```text

Incorrect or corrupted private key in Jenkins Credentials.

```



Solution:



1\. Verify the private key locally.

2\. Make sure the entire key is copied.

3\. Check the BEGIN/END lines.

4\. Update the Jenkins credential.

5\. Test SSH manually.

6\. Run the Jenkins pipeline again.



\---



\# 28. Problem 4 – Port 80 Already in Use



Check:



```bash

sudo ss -tulpn | grep :80

```



Or:



```bash

docker ps

```



If another container is using port 80, stop/remove it:



```bash

docker stop <container>

```



Then:



```bash

docker rm <container>

```



Start the FlightFinder container again.



\---



\# 29. Problem 5 – Container Is Not Running



Check:



```bash

docker ps -a

```



Then:



```bash

docker logs flightfinder-frontend

```



The logs normally tell us why the container stopped.



\---



\# 30. Problem 6 – Website Not Accessible



Check the EC2 security group.



HTTP must allow:



```text

TCP 80

```



Then check Docker:



```bash

docker ps

```



Check port mapping:



```text

0.0.0.0:80->80/tcp

```



Check Nginx logs:



```bash

docker logs flightfinder-frontend

```



\---



\# 31. Rollback Procedure



Because we use Jenkins build numbers as Docker tags, previous versions are available.



Example:



```text

Version 3

Version 4

Version 5

```



If version 5 has a problem, deploy version 4.



Pull:



```bash

docker pull ajaydhadi95/flightfinder-frontend:4

```



Stop the current container:



```bash

docker stop flightfinder-frontend

```



Remove it:



```bash

docker rm flightfinder-frontend

```



Start version 4:



```bash

docker run -d \\

&#x20;   --restart unless-stopped \\

&#x20;   --name flightfinder-frontend \\

&#x20;   -p 80:80 \\

&#x20;   ajaydhadi95/flightfinder-frontend:4

```



Verify:



```bash

docker ps

```



This gives us a simple rollback mechanism.



\---



\# 32. Successful Deployment Example



The successful Jenkins deployment was:



```text

Jenkins Build: #4



Docker Image:

ajaydhadi95/flightfinder-frontend:4



Frontend EC2:

13.200.254.41



Container:

flightfinder-frontend



Port:

80



Result:

Finished: SUCCESS

```



\---



\# 33. Production Deployment Flow



The final flow is:



```text

Developer

&#x20;   |

&#x20;   | Git Push

&#x20;   ↓

GitHub

&#x20;   |

&#x20;   ↓

Jenkins EC2

&#x20;   |

&#x20;   ├── Checkout

&#x20;   |

&#x20;   ├── Docker Build

&#x20;   |

&#x20;   ├── Docker Tag

&#x20;   |

&#x20;   ├── Docker Push

&#x20;   ↓

Docker Hub

&#x20;   |

&#x20;   ↓

SSH

&#x20;   |

&#x20;   ↓

Frontend EC2

&#x20;   |

&#x20;   ├── Docker Pull

&#x20;   |

&#x20;   ├── Stop Old Container

&#x20;   |

&#x20;   ├── Remove Old Container

&#x20;   |

&#x20;   └── Run New Container

&#x20;           |

&#x20;           ↓

&#x20;         Nginx

&#x20;           |

&#x20;           ↓

&#x20;      React Frontend

```



\---



\# 34. Operational Checklist



Before deployment:



```text

\[ ] GitHub repository is accessible

\[ ] Jenkins is running

\[ ] Docker is running on Jenkins

\[ ] Jenkins can execute Docker

\[ ] Docker Hub credentials are configured

\[ ] Frontend EC2 is running

\[ ] Docker is running on frontend EC2

\[ ] Port 80 is allowed

\[ ] SSH connectivity is working

\[ ] Jenkins SSH credential is configured

```



After deployment:



```text

\[ ] Jenkins build SUCCESS

\[ ] Docker image pushed to Docker Hub

\[ ] New image pulled on frontend EC2

\[ ] Container is running

\[ ] Port 80 is mapped

\[ ] Docker logs are normal

\[ ] Website opens in browser

```



\---



\# 35. Interview Explanation



If asked:



\*\*"Explain your CI/CD project."\*\*



Answer:



> "I implemented a CI/CD pipeline for a React-based FlightFinder frontend. The source code is maintained in GitHub. Jenkins automatically checks out the code and builds a multi-stage Docker image. The React application is built using Node.js and the production files are served using Nginx. Jenkins pushes the versioned Docker image to Docker Hub and then connects to the frontend EC2 instance using SSH. On the EC2 server, Jenkins pulls the new image, stops the old container, removes it, and starts the new container on port 80. I use Jenkins build numbers as Docker image tags, which also allows me to roll back to a previous version if required."



\---



\# 36. One-Line Project Summary



> \*\*"I automated the deployment of a React frontend using GitHub, Jenkins, Docker, Docker Hub, SSH, and AWS EC2, with Nginx serving the production application inside a Docker container."\*\*



\---



\# 37. Important Commands



\### Jenkins



```bash

sudo systemctl status jenkins

```



\### Docker



```bash

docker ps

docker ps -a

docker images

docker logs flightfinder-frontend

docker logs -f flightfinder-frontend

```



\### SSH



```bash

ssh -i \~/.ssh/id\_ed25519 ubuntu@13.200.254.41

```



\### Docker Pull



```bash

docker pull ajaydhadi95/flightfinder-frontend:4

```



\### Docker Run



```bash

docker run -d \\

&#x20;   --restart unless-stopped \\

&#x20;   --name flightfinder-frontend \\

&#x20;   -p 80:80 \\

&#x20;   ajaydhadi95/flightfinder-frontend:4

```



\### Browser Test



```text

http://13.200.254.41

```



\---



\# 38. Final Summary



The complete implementation is:



```text

GitHub

&#x20;  ↓

Jenkins

&#x20;  ↓

Checkout

&#x20;  ↓

Docker Build

&#x20;  ↓

Docker Image

&#x20;  ↓

Docker Hub

&#x20;  ↓

SSH

&#x20;  ↓

Frontend EC2

&#x20;  ↓

Docker Pull

&#x20;  ↓

Stop Old Container

&#x20;  ↓

Remove Old Container

&#x20;  ↓

Run New Container

&#x20;  ↓

Nginx

&#x20;  ↓

React Application

&#x20;  ↓

Port 80

```



This provides an automated and repeatable frontend deployment process with versioned Docker images and a simple rollback strategy.



