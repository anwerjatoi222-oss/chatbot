pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 10, unit: 'MINUTES')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                bat 'node --version'
            }
        }

        stage('Check Required Files') {
            steps {
                bat '''
                for %%f in (index.html style.css script.js faqs.json) do (if not exist %%f (echo Missing %%f & exit /b 1))
                echo All required files are present
                '''
            }
        }

        stage('Validate FAQ Data') {
            steps {
                bat 'node -e "JSON.parse(require(\'fs\').readFileSync(\'faqs.json\',\'utf8\')); console.log(\'faqs.json is valid\')"'
            }
        }

        stage('JavaScript Syntax Check') {
            steps {
                bat 'node --check script.js'
            }
        }

               stage('Deploy to GitHub Pages') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'github-token',
                                 usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                    bat '''
                    if exist deploy rmdir /s /q deploy
                    mkdir deploy
                    copy index.html deploy\\
                    copy style.css deploy\\
                    copy script.js deploy\\
                    copy faqs.json deploy\\
                    cd deploy
                    git init
                    git config user.email "jenkins@local"
                    git config user.name "Jenkins"
                    git checkout -b gh-pages
                    git add .
                    git commit -m "Deploy from Jenkins build %BUILD_NUMBER%"
                    git push --force https://%GH_USER%:%GH_TOKEN%@github.com/anwerjatoi222-oss/chatbot.git gh-pages
                    '''
                }
            }
        }
    }

    post {
        success { echo 'Chatbot pipeline SUCCESS' }
        failure { echo 'Chatbot pipeline FAILED' }
    }
}