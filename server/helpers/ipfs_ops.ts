import { promises as fs } from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import path from 'path'
import config from './../../config/config'

async function sync_to_ipfs() {
    const old_hash = await get_root_folder_hash()
    const images_folder = await fs.readdir(path.join(config.data_path, "images"))
    const thumbnails_folder = await fs.readdir(path.join(config.data_path, "thumbnails"))
    const _images_folder_ipfs = await axios.post("http://127.0.0.1:5001/api/v0/files/ls?arg=/ipfs_main/images", {}, { validateStatus: null })
    const images_folder_ipfs = (_images_folder_ipfs.data.Entries || []).map((el: any) => el.Name)
    const _thumbnails_folder_ipfs = await axios.post("http://127.0.0.1:5001/api/v0/files/ls?arg=/ipfs_main/thumbnails", {}, { validateStatus: null })
    const thumbnails_folder_ipfs = (_thumbnails_folder_ipfs.data.Entries || []).map((el: any) => el.Name)

    for (const file_name of images_folder) {
        if (!images_folder_ipfs.includes(file_name)) {
            const file_path = path.join(config.data_path, "images", file_name)
            console.log(`Adding images/${file_name}`)
            const file = await fs.readFile(file_path)
            await write_file_to_ipfs_folder(`/ipfs_main/images/${file_name}`, file)
        }
    }

    for (const file_name of images_folder_ipfs) {
        if (!images_folder.includes(file_name)) {
            console.log(`Removing images/${file_name}`)
            await rm_file(`/ipfs_main/images/${file_name}`)
        }
    }

    for (const file_name of thumbnails_folder) {
        if (!thumbnails_folder_ipfs.includes(file_name)) {
            const file_path = path.join(config.data_path, "thumbnails", file_name)
            console.log(`Adding thumbnails/${file_name}`)
            const file = await fs.readFile(file_path)
            await write_file_to_ipfs_folder(`/ipfs_main/thumbnails/${file_name}`, file)
        }
    }

    for (const file_name of thumbnails_folder_ipfs) {
        if (!images_folder.includes(file_name)) {
            console.log(`Removing thumbnails/${file_name}`)
            await rm_file(`/ipfs_main/thumbnails/${file_name}`)
        }
    }
    const new_hash = await get_root_folder_hash()
    if (old_hash === new_hash) {
        console.log("root folder is already synced")
        return
    }
    const update_hash_status = await update_folder_pin(old_hash, new_hash)
    console.log(update_hash_status)
    if (!update_hash_status) { return "Error updating folder's pin" }
    update_ipns(new_hash)
    console.log("synced successfully")
}
async function bootstrap() {
    try {
        const dir_exists = await axios.post("http://127.0.0.1:5001/api/v0/files/ls?arg=/ipfs_main", {}, { validateStatus: null })
        if (dir_exists.data?.Type === "error") {
            fs.mkdir(config.data_path)
            const create_dir1 = await axios.post("http://127.0.0.1:5001/api/v0/files/mkdir?arg=/ipfs_main", {}, { validateStatus: null })
            if (create_dir1.data?.Type !== "error") {
                const create_dir2 = await axios.post("http://127.0.0.1:5001/api/v0/files/mkdir?arg=/ipfs_main/thumbnails", {}, { validateStatus: null })
                const create_dir3 = await axios.post("http://127.0.0.1:5001/api/v0/files/mkdir?arg=/ipfs_main/images", {}, { validateStatus: null })
                if (create_dir2.data?.Type === "error" || create_dir3.data?.Type === "error") {
                    console.log("can't create subfolders")
                    process.exit()
                }
                fs.mkdir(path.join(config.data_path, "images"))
                fs.mkdir(path.join(config.data_path, "thumbnails"));
                const folder_hash = await get_root_folder_hash()
                await pin_file(folder_hash)
                console.log("bootstrap completed")
                await sync_to_ipfs()
            } else {
                console.log("can't create /ipfs_main")
                process.exit()
            }
        } else {
            console.log("bootstrap not needed")
            await sync_to_ipfs()
        }
    } catch (err) {
        console.log(err)
    }
}

async function rm_file(path: string) {
    try {
        const res = await axios.post(`http://127.0.0.1:5001/api/v0/files/rm?arg=${path}`)
        return res.data
    } catch (err) {
        console.log(err)
        return false
    }
}

async function pin_file(path: string) {
    try {
        const res = await axios.post(`http://127.0.0.1:5001/api/v0/pin/add?arg=${path}`)
        return res.data
    } catch (err) {
        console.log(err)
        return false
    }
}
async function get_root_folder_hash() {
    try {
        const hash = await axios.post("http://127.0.0.1:5001/api/v0/files/stat?arg=/ipfs_main")
        return hash.data.Hash ?? false
    } catch (err) {
        console.log(err)
        return false
    }
}
async function update_folder_pin(old_hash: string, new_hash: string) {
    try {
        const res = await axios.post(`http://127.0.0.1:5001/api/v0/pin/update?arg=${old_hash}&arg=${new_hash}`)
        return res.data
    } catch (err) {
        console.log(err)
    }
}

async function write_file_to_ipfs_folder(path: string, image: Buffer) {
    const form = new FormData();
    form.append('data', image, { filename: 'document' })
    const res = await axios.post(`http://127.0.0.1:5001/api/v0/files/write?arg=${path}&create=true`, form.getBuffer(), {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            ...form.getHeaders()
        }
    })
    return res.status
}

async function update_ipns(new_hash: string) {
        const res = await axios.post(`http://127.0.0.1:5001/api/v0/name/publish?arg=${new_hash}`)
        return res.data
}

async function add_file_to_ipfs(full_file_paths: string[], files: Buffer[]) {
    const old_hash = await get_root_folder_hash()
    console.log(old_hash)
    if (!old_hash) { return "Error getting folder's old hash" }

    for (let i = 0; i < full_file_paths.length; i++) {
        const full_file_path = full_file_paths[i]
        const write_status = await write_file_to_ipfs_folder(`/ipfs_main/${full_file_path}`, files[i])
        console.log(write_status)
    }
    const new_hash = await get_root_folder_hash()
    console.log(new_hash)
    if (!new_hash) { return "Error getting folder's new hash" }
    const update_hash_status = await update_folder_pin(old_hash, new_hash)
    console.log(update_hash_status)
    if (!update_hash_status) { return "Error updating folder's pin" }
    update_ipns(new_hash)
}

async function delete_file_from_ipfs(full_file_paths: string[]) {
    const old_hash = await get_root_folder_hash()
    for (const full_file_path of full_file_paths) {
        await rm_file(`/ipfs_main/${full_file_path}`)
    }
    const new_hash = await get_root_folder_hash()
    const update_hash_status = await update_folder_pin(old_hash, new_hash)
    console.log(update_hash_status)
    if (!update_hash_status) { return "Error updating folder's pin" }
    update_ipns(new_hash)
}
export default { add_file_to_ipfs, delete_file_from_ipfs, bootstrap }