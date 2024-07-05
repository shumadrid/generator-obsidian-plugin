import Generator from "yeoman-generator";
import yosay from "yosay";
import type { PromptQuestions } from "../../node_modules/yeoman-generator/dist/questions.d.ts";
import semver from "semver";
import { readdir } from "fs/promises";
import {
  dirname,
  join
} from "path";
import { fileURLToPath } from "url";

import _chalk from "chalk";
const chalk = _chalk as unknown as typeof _chalk.default;

const minimumNodeVersion = "18.0.0";
if (!semver.satisfies(process.version, `>=${minimumNodeVersion}`)) {
  console.error(`You need Node.js version ${minimumNodeVersion} or higher to use this generator.`);
  process.exit(1);
}

type Answers = {
  pluginId: string;
  pluginName: string;
  pluginShortName: string;
  pluginDescription: string;
  currentYear: number;
  authorName: string;
  authorGitHubName: string;
  isDesktopOnly: boolean;
  hasStyles: boolean;
};

export default class extends Generator {
  private answers!: Answers;

  public async prompting(): Promise<void> {
    this.log(
      yosay(
        `Welcome to the ${chalk.red("generator-obsidian-plugin")} generator!`,
      ),
    );

    const questions: PromptQuestions<Answers> = [
      {
        type: "input",
        name: nameof<Answers>("pluginId"),
        message: "Your plugin's id?",
        default: this.appname.replace(/^obsidian-/, ""),
        validate(pluginId: string): boolean | string {
          if (!pluginId) {
            return "Should not be empty";
          }

          if (!/^[a-z0-9-]+$/.test(pluginId)) {
            return "Should contain only lowercase English letters, digits and hyphens";
          }

          if (!/^[a-z]+/.test(pluginId[0]!)) {
            return "Should start with the letter";
          }

          if (!/^[a-z0-9]+/.test(pluginId.at(-1)!)) {
            return "Should end with the letter or digit";
          }

          if (pluginId.startsWith("obsidian-")) {
            return "Should not start with `obsidian-`";
          }

          return true;
        },
      },
      {
        type: "input",
        name: nameof<Answers>("pluginName"),
        message: "Your plugin's name?",
        default: (answers: Answers) => makePluginName(answers.pluginId),
      },
      {
        type: "input",
        name: nameof<Answers>("pluginDescription"),
        message: "Your plugin's description?",
        default: "Does something awesome",
      },
      {
        type: "input",
        name: nameof<Answers>("authorName"),
        message: "Your full name?",
        default: "John Doe",
      },
      {
        type: "input",
        name: nameof<Answers>("authorGitHubName"),
        message: "Your GitHub name?",
        default: "johndoe",
      },
      {
        type: "confirm",
        name: nameof<Answers>("isDesktopOnly"),
        message: "Is your plugin for Desktop only?",
        default: true,
      },
      {
        type: "confirm",
        name: nameof<Answers>("hasStyles"),
        message: "Does your plugin need CSS styles?",
        default: false,
      },
    ];

    this.answers = await this.prompt(questions);
    this.answers.currentYear = new Date().getFullYear();
    this.answers.pluginShortName = extractWords(this.answers.pluginId).join("");
  }

  public async writing(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const templatesDir = join(__dirname, "templates");

    for await (const filePath of getAllFiles(templatesDir)) {
      const templatePath = filePath.substring(templatesDir.length + 1);
      const destinationPath = getDestinationPath(templatePath, this.answers);
      if (!destinationPath) {
        continue;
      }

      this.fs.copyTpl(
        this.templatePath(templatePath),
        this.destinationPath(destinationPath),
        this.answers,
      );
    }

    const packageJson = {
      "name": this.answers.pluginId,
      "version": "0.0.0",
      "description": this.answers.pluginDescription,
      "scripts": {
        "build": "tsx scripts/npmScriptExecutor.ts build",
        "dev": "tsx scripts/npmScriptExecutor.ts dev",
        "lint": "tsx scripts/npmScriptExecutor.ts lint",
        "postversion": "tsx scripts/npmScriptExecutor.ts postversion",
        "preversion": "tsx scripts/npmScriptExecutor.ts preversion",
        "version": "tsx scripts/npmScriptExecutor.ts version"
      },
      "keywords": [],
      "author": this.answers.authorGitHubName,
      "license": "MIT",
      "devDependencies": {
        "@stylistic/eslint-plugin": "^2.3.0",
        "@tsconfig/strictest": "^2.0.5",
        "@types/eslint": "^8.56.10",
        "@types/node": "^20.14.9",
        "@typescript-eslint/eslint-plugin": "^7.15.0",
        "@typescript-eslint/parser": "^7.15.0",
        "builtin-modules": "^4.0.0",
        "esbuild": "^0.23.0",
        "eslint": "^8.57.0",
        "eslint-import-resolver-typescript": "^3.6.1",
        "eslint-plugin-import": "^2.29.1",
        "eslint-plugin-modules-newlines": "^0.0.7",
        "globals": "^15.8.0",
        "obsidian": "^1.5.7-1",
        "obsidian-typings": "mnaoumov/obsidian-typings#main",
        "tsx": "^4.16.2"
      },
      "type": "module"
    };

    this.fs.extendJSON(this.destinationPath("package.json"), packageJson);
  }
}

function makePluginName(pluginId: string): string {
  return extractWords(pluginId).join(" ");
}

function extractWords(pluginId: string): string[] {
  return pluginId.split("-").map(toPascalCase);
}

function toPascalCase(word: string): string {
  return (word[0] ?? "").toUpperCase() + word.substring(1);
}

function nameof<T>(name: Extract<keyof T, string>): string {
  return name;
}

async function* getAllFiles(dirPath: string): AsyncGenerator<string> {
  const files = await readdir(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dirPath, file.name);
    if (file.isDirectory()) {
      yield* getAllFiles(filePath);
    } else {
      yield filePath;
    }
  }
}

function getDestinationPath(templatePath: string, answers: Answers): string | null {
  templatePath = templatePath.replace(/%= (.+?) %/g, (_: string, answerKey: keyof Answers) => String(answers[answerKey]));

  if (templatePath.endsWith(".noext")) {
    return templatePath.slice(0, -".noext".length);
  }

  if (templatePath === "styles.css" && !answers.hasStyles) {
    return null;
  }

  return templatePath;
}
