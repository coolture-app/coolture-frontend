# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.

## IMPORTANT
This project has an Angular CLI installed locally, so every command must have a prefix 'npx'

## Before starting server
Firstly, after cloning repository, you need to navigate to frontend directory and install npm packages:
```bash
npm install
```

## Development server

To start a local development server, run:

```bash
npx ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
npx ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
npx ng generate --help
```

## Building

To build the project run:

```bash
npx ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npx ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
npx ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Linting and formatting

There are two commands in package.json for both linting and formatting. 
To format your code via prettier run:
```bash
npm run format
```

To check for misspelings and logical errors run:
```bash
npm run lint
```

To configure a Visual Studio Code to automatically format code on save:
* Install Prettier extension
* Open VSC settings
* Search for 'Format On Save'
* Turn this option on
* Select default formatter as Prettier

VSC should automatically detect our configuration and run it overi ts default one.
