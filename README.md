# AWS Access Application

## Introduction
This AWS Access Application use React on the front end, use NodeJS and Express on the back end. 
Functionalities:
1.AWS Connection
-Use AWS SDK to connect to AWS.
-Set the concurrent HTTP connections to each service endpoint.
-Configure delay time for TCP Keep-Alive.

2.S3 - AWS Simple Storage Service
-Create unique bucket name.
-Use promise to upload object to S3.

3.DynamoDB - NoSQL Cloud Database
Use class to handle DynamoDB table creation and Operation. 
-Create tables.
-List all tables.
-Import all of iteams from a JSON file to DynamoDB table.
-Add new item into the table.
-Delete the selected table. 
-To resolve the connection timeout issue, change the Http connection timeout setting from 120000msc to 240000msc.

4.Fetch
-Fetch customized data generator API

## Setup
- run ```npm i && npm start``` for both client and server side to start the development server
- Deploy DynamoDB Locally  
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

