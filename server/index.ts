import config from "./../config/config"
import fastify from 'fastify'
import fastifyMultipart from 'fastify-multipart'
import formBodyPlugin from 'fastify-formbody'
import ipfs_ops from './helpers/ipfs_ops'

const server = fastify()
server.register(formBodyPlugin)
server.register(fastifyMultipart, {
    attachFieldsToBody: true,
    sharedSchemaId: '#mySharedSchema',
    limits: {
        fieldNameSize: 100, // Max field name size in bytes
        fieldSize: 1000,     // Max field value size in bytes
        fields: 10,         // Max number of non-file fields
        fileSize: 50000000,  // For multipart forms, the max file size in bytes  //50MB
        files: 2,           // Max number of file fields
        headerPairs: 2000   // Max number of header key=>value pairs
    }
})

import upload_files from "./routes/upload_files"
import delete_files from "./routes/delete_files"

server.post("/upload_files", upload_files)
server.post("/delete_files", delete_files)

server.listen(config.server_port, "127.0.0.1", async function (err, address) {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    await ipfs_ops.bootstrap()
    console.log(`server listening on ${address}`)
})
