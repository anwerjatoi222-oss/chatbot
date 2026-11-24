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

        stage('Package') {
            steps {
                archiveArtifacts artifacts: 'index.html, style.css, script.js, faqs.json', fingerprint: true
            }
        }
    }

    post {
        success { echo 'Chatbot pipeline SUCCESS' }
        failure { echo 'Chatbot pipeline FAILED' }
    }
}