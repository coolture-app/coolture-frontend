import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Btn } from '../btn/btn';
import {
  centredView,
  clampView,
  CropView,
  coverScale,
  MAX_ZOOM,
  sourceSquare,
  zoomAt,
} from './avatar-crop';

const VIEWPORT = 260;
/** Large enough for the biggest avatar shown; the server makes the thumbnails. */
const OUTPUT = 512;
const KEY_STEP = 10;

/**
 * Lets you place a picked photo in the avatar's circle before it's saved: drag or arrow keys move it, the slider,
 * the wheel or a pinch zoom it. Emits a square JPEG of what the circle shows.
 */
@Component({
  selector: 'app-avatar-cropper',
  imports: [Btn, TranslatePipe],
  templateUrl: './avatar-cropper.html',
  styleUrl: './avatar-cropper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarCropper implements OnDestroy {
  readonly file = input.required<File>();
  readonly saved = output<Blob>();
  readonly cancelled = output<void>();

  readonly viewport = VIEWPORT;
  readonly url = computed(() => URL.createObjectURL(this.file()));
  readonly view = signal<CropView | null>(null);
  readonly failed = signal(false);
  readonly saving = signal(false);

  /** The slider's value, 1 to MAX_ZOOM, relative to the scale that just covers the circle. */
  readonly zoom = computed(() => {
    const view = this.view();
    const image = this.image()?.nativeElement;
    if (!view || !image?.naturalWidth) return 1;
    return view.scale / coverScale(image.naturalWidth, image.naturalHeight, VIEWPORT);
  });
  readonly maxZoom = MAX_ZOOM;
  readonly transform = computed(() => {
    const view = this.view();
    return view ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : '';
  });

  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private image = viewChild<ElementRef<HTMLImageElement>>('image');
  private pointers = new Map<number, { x: number; y: number }>();

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.url());
  }

  onLoad(): void {
    const { naturalWidth, naturalHeight } = this.image()!.nativeElement;
    this.view.set(centredView(naturalWidth, naturalHeight, VIEWPORT));
  }

  setZoom(zoom: number, px = VIEWPORT / 2, py = px): void {
    const view = this.view();
    const image = this.image()?.nativeElement;
    if (!view || !image) return;
    const scale = coverScale(image.naturalWidth, image.naturalHeight, VIEWPORT) * zoom;
    this.update(zoomAt(view, scale, px, py));
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.setZoom(
      this.zoom() * Math.exp(-event.deltaY * 0.002),
      event.clientX - box.left,
      event.clientY - box.top,
    );
  }

  onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  onPointerMove(event: PointerEvent): void {
    const last = this.pointers.get(event.pointerId);
    const view = this.view();
    if (!last || !view) return;
    const now = { x: event.clientX, y: event.clientY };

    if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)![1];
      const before = Math.hypot(last.x - other.x, last.y - other.y);
      const after = Math.hypot(now.x - other.x, now.y - other.y);
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      if (before > 0) {
        this.setZoom(
          this.zoom() * (after / before),
          (now.x + other.x) / 2 - box.left,
          (now.y + other.y) / 2 - box.top,
        );
      }
    } else {
      this.update({ ...view, x: view.x + now.x - last.x, y: view.y + now.y - last.y });
    }
    this.pointers.set(event.pointerId, now);
  }

  onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
  }

  onKey(event: KeyboardEvent): void {
    const view = this.view();
    if (!view) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      this.update({ ...view, x: view.x + move[0], y: view.y + move[1] });
    } else if (event.key === '+' || event.key === '=') {
      this.setZoom(this.zoom() * 1.1);
    } else if (event.key === '-') {
      this.setZoom(this.zoom() / 1.1);
    }
  }

  save(): void {
    const view = this.view();
    const image = this.image()?.nativeElement;
    if (!view || !image) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const { sx, sy, side } = sourceSquare(view, VIEWPORT);
    const context = canvas.getContext('2d')!;
    // JPEG has no transparency, so a transparent PNG or WebP would turn black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, OUTPUT, OUTPUT);
    context.drawImage(image, sx, sy, side, side, 0, 0, OUTPUT, OUTPUT);
    this.saving.set(true);
    canvas.toBlob(
      (blob) => {
        this.saving.set(false);
        if (blob) {
          this.close();
          this.saved.emit(blob);
        } else {
          this.failed.set(true);
        }
      },
      'image/jpeg',
      0.9,
    );
  }

  cancel(): void {
    this.close();
    this.cancelled.emit();
  }

  private close(): void {
    this.dialog().nativeElement.close();
  }

  private update(view: CropView): void {
    const image = this.image()!.nativeElement;
    this.view.set(clampView(view, image.naturalWidth, image.naturalHeight, VIEWPORT));
  }
}
