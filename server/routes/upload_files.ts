import { FastifyRequest, FastifyReply } from "fastify"
import { FromSchema } from "json-schema-to-ts"
import config from "./../../config/config"
import ipfs_ops from "./../helpers/ipfs_ops"
import { promises as fs } from 'fs'
import path from 'path'
const body_schema_upload_files = {
    type: 'object',
    properties: {
        images: { type: "array", items: { $ref: '#mySharedSchema' }, },
        full_paths: {
            type: "object",
            properties: {
                value: { type: "string" }
            }
        },
    },
    required: ['images', 'full_paths'],
} as const;

async function upload_files(req: FastifyRequest<{ Body: FromSchema<typeof body_schema_upload_files> }>, res: FastifyReply) {
    try {
        if (req.body.full_paths.value) {
            const full_file_paths = JSON.parse(req.body.full_paths.value)
            const buffers: Buffer[] = await Promise.all(req.body.images.map(async (el: any) => el.toBuffer()))
            if (buffers.length !== full_file_paths.length) {
                return res.status(403).send
            }
            await ipfs_ops.add_file_to_ipfs(full_file_paths, buffers)
            for (let i = 0; i < full_file_paths.length; i++) {
                const full_file_path = full_file_paths[i]
                await fs.writeFile(path.join(config.data_path, full_file_path), buffers[i])
            }
            res.status(200).send()
        }
    } catch (err) {
        console.log(err)
        res.status(500).send()
    }
}

export default {
    schema: {
        body: body_schema_upload_files
    },
    handler: upload_files
}