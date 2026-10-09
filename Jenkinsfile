pipeline {
agent any


environment {
    AWS_REGION  = 'ap-south-1'
    EKS_CLUSTER = 'devops-eks'
    KUBECONFIG  = '/var/lib/jenkins/.kube/config'

    IMAGE_NAME  = 'ajaydhadi95/booking_frontend'
    IMAGE_TAG   = "${BUILD_NUMBER}"

    APP_NAME    = 'booking-frontend'
    SERVICE_NAME = 'booking-frontend-service'
}

stages {
    stage('Checkout') {
        steps {
            git branch: 'main',
                url: 'https://github.com/ajaydhadi95-gif/React_Fronend.git'
        }
    }

    stage('Verify Project') {
        steps {
            sh '''
                set -e
                echo "Checking frontend files..."
                test -f package.json
                test -f Dockerfile
                echo "Project files verified."
            '''
        }
    }

    stage('Build Docker Image') {
        steps {
            sh '''
                set -e
                docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
            '''
        }
    }

    stage('Push Image to Docker Hub') {
        steps {
            withCredentials([
                usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKERHUB_USER',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )
            ]) {
                sh '''
                    set +x
                    echo "$DOCKERHUB_TOKEN" |
                      docker login -u "$DOCKERHUB_USER" --password-stdin

                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker logout
                '''
            }
        }
    }

    stage('Connect to EKS') {
        steps {
            sh '''
                set -e
                aws eks update-kubeconfig \
                  --region ${AWS_REGION} \
                  --name ${EKS_CLUSTER}

                kubectl get nodes
            '''
        }
    }

    stage('Deploy to EKS') {
        steps {
            sh '''
                set -e

                kubectl create deployment ${APP_NAME} \
                  --image=${IMAGE_NAME}:${IMAGE_TAG} \
                  --dry-run=client -o yaml | kubectl apply -f -

                kubectl set image deployment/${APP_NAME} \
                  ${APP_NAME}=${IMAGE_NAME}:${IMAGE_TAG}

                kubectl rollout status deployment/${APP_NAME} \
                  --timeout=180s

                kubectl expose deployment ${APP_NAME} \
                  --name=${SERVICE_NAME} \
                  --type=LoadBalancer \
                  --port=80 \
                  --target-port=80 \
                  --dry-run=client -o yaml | kubectl apply -f -

                kubectl get deployments
                kubectl get pods -o wide
                kubectl get svc ${SERVICE_NAME}
            '''
        }
    }
}

post {
    success {
        echo 'SUCCESS: Frontend deployed to EKS.'
    }
    failure {
        echo 'FAILED: Check the Jenkins Console Output.'
    }
}
}
