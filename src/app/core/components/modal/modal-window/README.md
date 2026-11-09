# Modal window

A dialog that asks Tak / Nie (`YESNO`) or just confirms (`OK`). Used to confirm deleting a comment or a post, for example
in `comment-component.html`.

| Input or output | Meaning                                                       | Values                      |
| --------------- | ------------------------------------------------------------- | --------------------------- |
| `modalType`     | Which buttons it shows                                        | `YESNO`, `OK` (default)     |
| `title`         | Title                                                         | text                        |
| `text`          | Body                                                          | text                        |
| `(modalAction)` | Emits the button pressed, or `CANCEL` when closed with Escape | `YES`, `NO`, `OK`, `CANCEL` |

Import `ModalWindow` into the component, put it anywhere in the template, and open it from code:

```html
<app-modal-window
  #deleteModal
  modalType="YESNO"
  [title]="'COMMENT.modal-delete-title' | translate"
  [text]="'COMMENT.modal-delete-body' | translate"
  (modalAction)="onDeleteAnswer($event)"
/>
```

```ts
private deleteModal = viewChild<ModalWindow>('deleteModal');

askToDelete(): void {
  this.deleteModal()?.open();
}

onDeleteAnswer(action: string): void {
  if (action === 'YES') {
    this.deleteComment();
  }
}
```
