import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-form-file-upload',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './form-file-upload.html',
  styleUrl: './form-file-upload.scss',
})
export class FormFileUpload {
  @Input() label = '';
  @Input() accept = 'image/*';
  @Input() multiple = true;
  @Input() buttonText = 'POST_FORM.media-click';
  @Input() required = false;
  @Input() optionalLabel = 'POST_FORM.optional';
  @Input() disabled = false;

  @Output() filesSelected = new EventEmitter<File[]>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragOver = false;

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.filesSelected.emit(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files?.length) {
      const files = Array.from(event.dataTransfer.files);
      const acceptedFiles = this.accept ? files.filter((f) => this.matchesAccept(f)) : files;
      if (acceptedFiles.length > 0) {
        this.filesSelected.emit(acceptedFiles);
      }
    }
  }

  private matchesAccept(file: File): boolean {
    if (!this.accept) return true;
    const accepted = this.accept.split(',').map((a) => a.trim());
    return accepted.some((acc) => {
      if (acc.endsWith('/*')) {
        const type = acc.replace('/*', '');
        return file.type.startsWith(type);
      }
      return file.type === acc;
    });
  }
}
