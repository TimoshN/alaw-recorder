const {contextBridge} = require("electron")
const fs = require("fs")
const { v4: uuidv4 } = require('uuid');
const path = require('path')

/** @type {fs.WriteStream} */
let writableStream

contextBridge.exposeInMainWorld("api", {
    writeToStream: (data)=>{
        let filePath;
        if(!writableStream) {
            filePath = path.join(__dirname, 'output', `${uuidv4()}.wav`)
            writableStream = fs.createWriteStream(filePath)
        }
        writableStream.write(data)

        return filePath;
    },
    closeStream: ()=>{
        if(writableStream) {
            writableStream.close()
            writableStream = null;
        }
    }
})