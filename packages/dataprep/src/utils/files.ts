import Ajv, { Schema } from "ajv";
import { promises as fsp } from "fs";
import * as fs from "fs";
import * as path from "path";
import { decodeStream } from "iconv-lite";
import papa from "papaparse";

/**
 * Create a folder at the specified location.
 * If the folder already exist, do nothing.
 */
export async function checkExists(fileOrFolderPath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    fs.exists(path.resolve(fileOrFolderPath), (exist) => resolve(exist));
  });
}

/**
 * Create a folder at the specified location.
 * If the folder already exist, do nothing.
 */
export async function createFolder(folder: string): Promise<void> {
  const folderPath = path.resolve(folder);
  if (!(await checkExists(folderPath))) await fs.mkdirSync(folderPath, { recursive: true });
}

/**
 * Clean folder at the specified location.
 * Throws an exception if the given folder doesn't exists.
 */
export async function cleanFolder(folder: string): Promise<void> {
  const folderPath = path.dirname(path.resolve(folder));
  if (!(await checkExists(folderPath))) throw new Error(`Folder ${folderPath} is missing, can't clean it`);
  await fsp.rm(folderPath, { recursive: true });
}

/**
 * Create a file into the export folder.
 */
export async function writeFile(file: string, content: unknown): Promise<void> {
  const filePath = path.resolve(file);
  let data = `${content}`;
  if (typeof content === "object") data = JSON.stringify(content);

  await createFolder(path.dirname(filePath));
  await fsp.writeFile(filePath, data, "utf-8");
}

/**
 * List files (with the specified extension if specified) of a folder .
 * Throws an error if the given folder doesn't exists.
 */
export async function listFolder(
  folder: string,
  opts?: { extension?: string; onlyFolder?: boolean },
): Promise<Array<string>> {
  const folderPath = path.dirname(path.resolve(folder));
  if (!(await checkExists(folderPath))) throw new Error(`Folder ${folderPath} is missing, can't list it`);
  const files = await fsp.readdir(folder, { withFileTypes: true });

  return files
    .filter((f) => {
      if (opts && opts.extension) return path.extname(f.name) === opts.extension;
      if (opts && opts.onlyFolder) return f.isDirectory();
      return true;
    })
    .map((f) => path.resolve(folder, f.name));
}

/**
 * read a file and returns its content as a string.
 */
export async function readFile(file: string): Promise<string> {
  const content = await fsp.readFile(file, { encoding: "utf8" });
  return content;
}

/**
 * Read file a parse it as JSON.
 * If schema is specified, the function will validate the json against it.
 */
export async function readJson<T>(file: string, schema?: Schema, stopOnErrors?: boolean): Promise<T> {
  try {
    // remove old validation error file if it exists
    const validationErrorFile = `${path.dirname(file)}/validation_errors.json`;
    await remove(validationErrorFile);

    const data = await readFile(file);
    const json = JSON.parse(data);
    if (schema) {
      const ajv = new Ajv({ strict: false });
      const validateJson = await ajv.compile(schema);
      if (!validateJson(json)) {
        if (validateJson.errors) {
          const errorsAsString = validateJson.errors.map((e) => JSON.stringify(e, null, 2)).join("\n");
          await writeFile(validationErrorFile, errorsAsString);
          if (stopOnErrors) throw new Error(errorsAsString);
          else {
            console.log(
              `/!\\ ${file}: ${validateJson.errors.length} validation errors wrote in validation_errors.json`,
            );
          }
        } else if (stopOnErrors) throw new Error("Validation fails");
      }
    }
    return json as unknown as T;
  } catch (e) {
    throw new Error(`Reading file ${file} failed : ${e}`);
  }
}

export async function readCsv<T>(file: string, delimiter = ","): Promise<Array<T>> {
  if (!(await checkExists(file))) throw new Error(`File ${file} is missing, can't read it`);
  return new Promise((resolve, reject) => {
    // ensure decoding see https://github.com/mholt/PapaParse/issues/908
    const streamDecoder = decodeStream("UTF8");
    const fileStream = fs.createReadStream(path.resolve(file)).pipe(streamDecoder);
    papa.parse<T>(fileStream, {
      delimiter,
      header: true,
      encoding: "utf-8",
      skipEmptyLines: true,
      error: (e) => reject(e),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          reject(`Failed to parse CSV file ${file} : ${results.errors.map((e) => e.message).join(", ")}`);
        }
        resolve(results.data);
      },
    });
  });
}

export async function copy(source: string, target: string): Promise<void> {
  if (fs.lstatSync(source).isDirectory()) await fsp.cp(source, target, { recursive: true });
  else await fsp.copyFile(source, target);
}

export function getFilenameFromPath(filePath: string): string {
  const name1 = path.basename(filePath);
  const ext1 = path.extname(filePath);
  return path.basename(name1, ext1);
}

/**
 * Remove a file if it exists
 */
export async function remove(file: string): Promise<void> {
  if (fs.existsSync(file)) await fs.promises.rm(file);
}
