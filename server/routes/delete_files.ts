import { FastifyRequest, FastifyReply } from "fastify"
import { FromSchema } from "json-schema-to-ts"
import config from "./../../config/config"
import { promises as fs } from 'fs'
import path from 'path'
import ipfs_ops from "./../helpers/ipfs_ops"

const body_schema_delete_files = {
    type: 'object',
    properties: {
        full_paths: { type: "array", items: { type: "string" } }
    },
    required: ['full_paths'],
} as const;

async function delete_files(req: FastifyRequest<{ Body: FromSchema<typeof body_schema_delete_files> }>, res: FastifyReply) {
    try {
        const full_file_paths = req.body.full_paths
        await ipfs_ops.delete_file_from_ipfs(full_file_paths)
        for (const full_file_path of full_file_paths) {
            await fs.unlink(path.join(config.data_path, full_file_path))
        }
        res.status(200).send()
    } catch (err) {
        console.log(err)
        res.status(500).send()
    }
}

export default {
    schema: {
        body: body_schema_delete_files
    },
    handler: delete_files
}