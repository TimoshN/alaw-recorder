const {contextBridge} = require("electron")
const fs = require("fs")
const { v4: uuidv4 } = require('uuid');
const path = require('path')

/** @type {fs.WriteStream} */
let writableStream

contextBridge.exposeInMainWorld("api", {
    writeToStream: (data)=>{
        if(!writableStream) {
            writableStream = fs.createWriteStream(path.join(__dirname, 'output', `${uuidv4()}.wav`))
        }
        writableStream.write(data)
    },
    closeStream: ()=>{
        if(writableStream) {
            writableStream.close()
            writableStream = null;
        }
    }
})