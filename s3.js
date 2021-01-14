require('dotenv').config();
const multer = require('multer');
const fs = require('fs');
const AWS = require('aws-sdk');

//AWS
const AWS_S3_HOST_NAME = process.env.AWS_S3_HOST_NAME;
const AWS_S3_BUCKETNAME = process.env.AWS_S3_BUCKETNAME;
const spaceEndPoint = new AWS.Endpoint(AWS_S3_HOST_NAME);
const s3 = new AWS.S3({
    endpoint: spaceEndPoint,
    accessKeyId: process.env.AWS_S3_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY
})

// Upload to Temporary directory
// create an upload using multer to upload the file to tmp dir 
const upload = multer({ 
    dest: process.env.TMP_DIR || './tmp/' 
})

const s3PutObject = (file, buff, s3) => new Promise ( (resolve, reject) =>{
    const params = {
        Bucket: AWS_S3_BUCKETNAME,
        Key: file.filename,
        Body: buff,
        ACL: 'public-read',
        ContentType: file.mimetype,
        ContentLength: file.size
    }

    s3.upload(params, (err, data) => {
        if(err)
            reject(err);
        else
            resolve(data);
    })
})

const s3RemoveObject = (key, s3) => new Promise( (resolve, reject) => {
    let params = {
        Bucket: AWS_S3_BUCKETNAME,
        Key: key
    }

    s3.deleteObject(params, (err, data) => {
        if(err)
            reject(err);
        else
            resolve(data);
    })
})

const readFile = (file) => new Promise( (resolve, reject) => {
    fs.readFile(file, (err, image) => {
        if(null != err)
            reject(err);
        else
            resolve(image);
    })    
})  

module.exports = {s3PutObject, s3RemoveObject, upload, readFile, s3, fs};