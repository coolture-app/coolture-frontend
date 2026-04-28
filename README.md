# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.
Node.js version required: v22.x
npm: 10.x

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

- Install Prettier extension
- Open VSC settings
- Search for 'Format On Save'
- Turn this option on
- Select default formatter as Prettier

VSC should automatically detect our configuration and run it overi ts default one.

## USING MODAL WINDOW

To use modal window in other component firstly you have to import the modal winodw:

```js
import { ModalWindow } from 'path/to/modal';
```

then you have to add it into imports:

```js
imports: [ModalWindow],
```

in html template you insert this block of code (doesnt matter where you place it):

```html
<app-modal-window
  #myModal
  modalType="YESNO"
  [title]="'COMMENT.modal-delete-title' | translate"
  [text]="'COMMENT.modal-delete-body' | translate"
  (modalAction)="handleModalResponse($event)"
>
</app-modal-window>
```

| Attribute   | Role                                                                            | Options        |
| ----------- | ------------------------------------------------------------------------------- | -------------- |
| modalType   | Defines what modal type will be used.                                           | YESNO / OK     |
| title       | Title of modal                                                                  | signal(string) |
| text        | Text of modal                                                                   | signal(string) |
| modalAction | handler to function in parent component that collectts input of user from modal | yes/no/ok      |

in parent you create a variable that is a handler to the modal:

```js
  @ViewChild('myModal') myModal?: ModalWindow;
```

then you have to implement 2 functions:

this is used to open modal (for example you bind it to (click)='openModal()' of a button)

```js
openModal(): void {
    this.myModal?.open();
  }
```

this gets a repsonse from modal

```js
 handleModalResponse(action: string): void {
    if (action === 'YES') {
      this.deleteComment();
    }
  }
```
