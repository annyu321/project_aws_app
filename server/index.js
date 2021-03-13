const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const AWS = require("aws-sdk");
const uuid = require('uuid');
const fetch = require('node-fetch');
const blueBird = require('bluebird');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const router = require('./router');

//Import the DynamoDBaccess module
var dynamodbHandler = require('./DynamoDBaccess');
var dynamodbTableHandler = dynamodbHandler.dynamodbTableHandler;
var dynamodb = dynamodbHandler.dynamodb;

const app = express();
const hostname = '127.0.0.1';
const port = 5000;
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(router);
fetch.Promise = blueBird;

AWS.config.getCredentials(function (err) {
    if (err) console.log("Get Credential Error: ", err.stack);
    // credentials not loaded
    else {
        console.log("My Access key:", AWS.config.credentials.accessKeyId);
        console.log("Region: ", AWS.config.region);
    }
});


//S3
// Create unique bucket name
var bucketName = 'node-sdk-sample-' + uuid.v4();
// Create name for uploaded object key
var keyName = 'hello_world.txt';

// Create a promise on S3 service object
var bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();

// Handle promise fulfilled/rejected states
bucketPromise.then(
    function (data) {
        // Create params for putObject call
        var objectParams = { Bucket: bucketName, Key: keyName, Body: 'Hello World!' };
        // Create object upload promise
        var uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
        uploadPromise.then(
            function (data) {
                console.log("Successfully uploaded data to " + bucketName + "/" + keyName);
            });
    }).catch(
        function (err) {
            console.error(err, err.stack);
        });
console.log("In Asynch Routine");

//DynamoDB
//Tuning AWS SDK HTTP settings for latency - aware Amazon DynamoDB applications
var targetTableName = 'Movies';
var targetTableHandler = new dynamodbTableHandler(targetTableName);
checkExistTable = targetTableHandler.setTableName();

//List all of tables
//Delete all tables if the delete flag is true
//var deleteFlag = true;
var deleteFlag = false;
targetTableHandler.deleteAllTables(deleteFlag).then((result) => {
    //console.log('Delete Result', result);

    }).catch((error) => console.log('Delete Table Error', error));

//If delete table flag is true, set timer to 5 seconds to complete the table deleting, start to checktable existence and create table if it's not exist
//If delete table falg is false, set timer to 500 milliseconds
deleteFlag === true ? setTimeout(handleTable, 5000) : setTimeout(handleTable, 500);

//Fetch customized data generator API
const url = 'https://randomuser.me/api/?results=3';

fetch(url)
    .then((resp) => resp.json())
    .then(function (data) {
        let authors = data.results;
        console.log(authors);
    })
    .catch(function (error) {
        console.log(error);
    });


//Websocket
io.on('connect', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if(error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.`});
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit('message', { user: user.name, text: message });

    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if(user) {
      io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
    }
  })
});

function handleTable()
{
    var tableExistenceCheckPromise = dynamodb.describeTable(checkExistTable).promise();
    tableExistenceCheckPromise.then(
        function (data) {
            const checkTableObj = JSON.parse(JSON.stringify(data, null, 2));
            console.log("Describe Table:", checkTableObj.Table.TableName, checkTableObj.Table.TableStatus);
            if (checkTableObj.Table.TableStatus === "ACTIVE") {
                var year = 2015;
                var title = "The Big New Movie";

                var params = {
                    TableName: 'Movies',
                    Item: {
                        "year": year,
                        "title": title,
                        "info": {
                            "plot": "Nothing happens at all.",
                            "rating": 0
                        }
                    }
                };

                //create new item in the table
                targetTableHandler.addNewItem(params);

            } else {
                console.log("DynamoDB Table Creation Exception", JSON.stringify(data, null, 2));
            }
        }).catch(
            function (err) {
                let checkTableObj = JSON.parse(JSON.stringify(err, null, 2));
                console.log("Check Table Existence Error: ", checkTableObj.message, checkTableObj.code);

                if (checkTableObj.message.includes("non-existent table") && checkTableObj.code === "ResourceNotFoundException") {
                    //Table non-existent. Create this table
                    targetTableHandler.createTableHandler();
                } else {
                    console.log("Check Table Existence Exception: ", checkTableObj.message, checkTableObj.code);
                }
            }
        );
}

server.listen(process.env.PORT || 5000, hostname, () => console.log(`Server has started.`));

//Received the SIGTERM signal to gracefully terminate the process
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Process terminated')
    })
})
