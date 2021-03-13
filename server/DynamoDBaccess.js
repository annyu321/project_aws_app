const AWS = require("aws-sdk");
var fs = require('fs');

//set maxSockets for all service objects you create
//allows up to 25 concurrent connections to each service endpoint.
//If the maxSockets value is not defined or is Infinity, the SDK assumes a maxSockets value of 50.
//If keepAlive is enabled, you can also set the initial delay for TCP Keep-Alive packets with keepAliveMsecs, which by default is 1000ms.
var agent = new https.Agent({
    maxSockets: 25
    keepAlive: true,
    // Infinitity is read as 50 sockets
    //maxSockets: Infinity
});

AWS.config.update({
    httpOptions: {
        agent: agent
    }
});


//DynamoDB
AWS.config.update({
    region: "us-west-2",
    //region: "us-east-1",
    endpoint: "http://localhost:8000"
});

//per service DynamoDB
var dynamodb = new AWS.DynamoDB({
    apiVersion: '2012-08-10'
    //httpOptions: {
    //    agent: agent
    // }
});

var docClient = new AWS.DynamoDB.DocumentClient();

//To resolve the connection timeout issue, change the Http connection timeout setting from 120000msc to 240000msc
//The total 4609 items in the file moviedata.json are put in the DynamoDB Movie table successfuly.
var docClient = new AWS.DynamoDB.DocumentClient({
    httpOptions: {
        timeout: 240000
    }
});

//Class to handle DynamoDB table creation and Operation
class dynamodbTableHandler {
    constructor(name) {
        this.name = name;
    }

    setTableName() {
        var checkExistTable = {
            TableName: this.name
        };
       // checkExistTable.TableName = this.name
        return checkExistTable;
    }

    getTableName() {
        return this.name;
    }

    createTableHandler( ) {
        var params = {
            TableName: "Sessions",

            KeySchema: [
                { AttributeName: "year", KeyType: "HASH" },  //Partition key
                { AttributeName: "title", KeyType: "RANGE" }  //Sort key
            ],
            AttributeDefinitions: [
                { AttributeName: "year", AttributeType: "N" },
                { AttributeName: "title", AttributeType: "S" }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 10,
                WriteCapacityUnits: 10
            }
        };

        //params[this.tableNameKey] = this.Name;
        //params[tt] = tName;
        //Dynamically update objects' properly
        params.TableName = this.name;

        var dataSourceFile = 'moviedata.json';
        dynamodb.createTable(params, (err, data) => {
            if (err) {
                console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
            } else if (data) {
                console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
                //Import items from file to table
                this.importItemstoTable(params.TableName, dataSourceFile);
            }
        });
    }

    //Add new item into the table
    addNewItem(params) {
        return new Promise((resolve, reject) => {
            docClient.put(params, function (err, data) {
                if (err) {
                    reject(err);
                    console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    resolve(data);
                    console.log("PutItem succeeded:", params);
                }
            });
        });
    }

    listAllTables() {
        return new Promise((resolve, reject) => {
            dynamodb.listTables({}, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            })
        })
    }


    //List all of the tables
    //Delete all of the tables if the delete flag is true
    deleteAllTables(deleteFlag) {
            return new Promise((resolve, reject) => {
                var tables = [];
                var params = {
                    TableName: "SSS"
                };

                dynamodb.listTables({}, (err, data) => {
                    if (err) {
                        reject(err);
                        return console.log("Error in listing tables", err);
                    } else {
                        resolve(data);
                        tables = tables.concat(data.TableNames);
                        console.log("Total Number of Tables", tables.length, tables);
                        if (deleteFlag === true) {  
                            if (tables.length) {
                                tables.forEach(element => {
                                    params.TableName = element;
                                    dynamodb.deleteTable(params, function (err, data) {
                                        if (err) return console.log(err, err.stack); // an error occurred
                                        else console.log("Deleted Tables", data);
                                    });
                                });
                            } else {
                                console.log("No Tables exist for deleting");
                                return;
                            }
                        } 
                    };
                });
            })
    }

   
    createTables(tableSetParams ) {
        //Set the target table name in the prameter object
        var checkTableExistence = this.setTableName();

        //The functions of this.importItemstoTable, this.addNewItem can be executed properly in here
        //But there is a problem with the AWS-SDK is they are exceuted inside Promise
        this.importItemstoTable('Movies', 'moviedata.json');

        //Create the target table and read items from the specific JSON file
        var tableExistenceCheckPromise = dynamodb.describeTable(checkTableExistence).promise();
        tableExistenceCheckPromise.then(
            function (data) {
                const checkTableObj = JSON.parse(JSON.stringify(data, null, 2));
                console.log("Describe Table:", checkTableObj.Table.TableName, checkTableObj.Table.TableStatus);
                if (checkTableObj.Table.TableStatus === "ACTIVE") {
                    tableSetParams.tableExistenceFlag = true;
                    console.log('table Set Existence Flag', tableSetParams.tableExistenceFlag);
                
                    var year = 2015;
                    var title = "The Big New Movie";

                    var addItemParams = {
                        TableName: tableSetParams.targetTableName,
                        Item: {
                            "year": year,
                            "title": title,
                            "info": {
                                "plot": "Nothing happens at all.",
                                "rating": 0
                            }
                        }
                    };

                    //Add New Item
                    docClient.put(addItemParams, function (err, data) {
                        if (err) {
                            //reject(err);
                            console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                        } else {
                            //resolve(data);
                            console.log("PutItem succeeded:", addItemParams);
                        }
                    });

                    //create new item in the table
                
                   // process.nextTick(() => {
                   //     this.addNewItems(addItemParams);
                   // });
                       
                   // this.addNewItem(params).then((result) => console.log('Added New Item', result))
                     //                      .catch((error) => console.log('Error in Adding New Item', error));

                    

                } else {
                   return  console.log("DynamoDB Table Creation Exception", JSON.stringify(data, null, 2));
                }
            }).catch( 
                function (err) {
                    let checkTableObj = JSON.parse(JSON.stringify(err, null, 2));
                    console.log("Check Table Existence Error: ", checkTableObj.message, checkTableObj.code);

                    if (checkTableObj.message.includes("non-existent table") && checkTableObj.code === "ResourceNotFoundException") {
                        //Table non-existent. Create this table
                        //this.createTableHandler();
                        var params = {
                            TableName: 'Movies',

                            KeySchema: [
                                { AttributeName: "year", KeyType: "HASH" },  //Partition key
                                { AttributeName: "title", KeyType: "RANGE" }  //Sort key
                            ],
                            AttributeDefinitions: [
                                { AttributeName: "year", AttributeType: "N" },
                                { AttributeName: "title", AttributeType: "S" }
                            ],
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 10,
                                WriteCapacityUnits: 10
                            }
                        };
    
                        //params.TableName = this.name;

                        var dataSourceFile = 'moviedata.json';
                        dynamodb.createTable(params, (err, data) => {
                            if (err) {
                                console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
                            } else if (data) {
                                console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
                                //Import items from file to table
                               // this.importItemstoTable(params.TableName, dataSourceFile);
                            }
                        });
                    } else {
                        console.log("Check Table Existence Exception: ", checkTableObj.message, checkTableObj.code);
                    }
                }
                
            );
    }

    //Import all of iteams from JSON file to DynamoDB table 
    importItemstoTable(tableName, dataSourceFile)  {
        console.log("Importing movies into DynamoDB. Please wait.");

        //var allMovies = JSON.parse(fs.readFileSync('moviedata.json', 'utf8'));
        var allMovies = JSON.parse(fs.readFileSync(dataSourceFile, 'utf8'));
        var totalNumber = 0;
        var successNumber = 0;
        allMovies.forEach(function (movie) {
            totalNumber++;
            var params = {
                TableName: "Movies",
                Item: {
                    "year": movie.year,
                    "title": movie.title,
                    "info": movie.info
                }
            };
            params.TableName = tableName;

            docClient.put(params, (err, data) => {
                if (err) {
                    console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
                } else if (data) {
                    successNumber++;
                    console.log(movie.title, successNumber, totalNumber);
                }
            });
        });
    }
}


//Export the dynamodbTableHandler class
module.exports = {
    dynamodbTableHandler: dynamodbTableHandler,
    dynamodb: dynamodb
};