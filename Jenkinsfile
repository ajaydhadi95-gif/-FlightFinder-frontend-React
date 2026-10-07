pipeline {

    agent any

    environment {
        IMAGE_NAME = 'ajaydhadi95/flightfinder-frontend'
        IMAGE_TAG  = "${BUILD_NUMBER}"
        FRONTEND_EC2 = '65.2.171.100'
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/ajaydhadi95-gif/-FlightFinder-frontend-React.git'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
                sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest"
            }
        }

        stage('Docker Push') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {

                    sh '''
                        echo "$DOCKER_PASSWORD" | docker login \
                        -u "$DOCKER_USERNAME" \
                        --password-stdin
                    '''

                    sh "docker push ${IMAGE_NAME}:${IMAGE_TAG}"
                    sh "docker push ${IMAGE_NAME}:latest"
                }
            }
        }

        stage('Deploy to Frontend EC2') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'frontend-ec2-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {

                    sh """
                        ssh -o StrictHostKeyChecking=no \
                            -i "\$SSH_KEY" \
                            "\$SSH_USER@${FRONTEND_EC2}" '
                            
                            docker pull ${IMAGE_NAME}:${IMAGE_TAG}

                            docker stop flightfinder-frontend || true

                            docker rm flightfinder-frontend || true

                            docker run -d \
                                --restart unless-stopped \
                                --name flightfinder-frontend \
                                -p 80:80 \
                                ${IMAGE_NAME}:${IMAGE_TAG}

                            docker ps
                        '
                    """
                }
            }
        }
    }

    post {

        success {
            echo 'FlightFinder Frontend deployed successfully!'
        }

        failure {
            echo 'FlightFinder Frontend deployment failed!'
        }
    }
}

