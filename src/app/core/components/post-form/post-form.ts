import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
  OnInit,
  OnChanges,
  SimpleChanges,
  DestroyRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  lastValueFrom,
  Observable,
  of,
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
} from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MapComponent as MglMapComponent, MarkerComponent } from '@maplibre/ngx-maplibre-gl';
import { MapMouseEvent } from 'maplibre-gl';
import {
  GeocodingService,
  NominatimSearchResult,
} from '../../services/geocoding/geocoding.service';

import { FormInput } from '../form-input/form-input';
import { FormSelect, SelectOption } from '../form-select/form-select';
import { FormTextarea } from '../form-textarea/form-textarea';
import { FormFileUpload } from '../form-file-upload/form-file-upload';
import { Btn } from '../btn/btn';

import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { PostType, PostVisibility } from '../../models/common/enums';
import { MediaService } from '../../services/media/media.service';
import { DictionaryService } from '../../services/dictionary/dictionary.service';
import { CountryCode } from '../../models/dictionary/country-code.model';
import { MediaResource } from '../../models/media/media-resource.model';

interface MediaPreview {
  file: File;
  previewUrl: string;
  isUploading: boolean;
  mediaId?: string;
}

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    FormInput,
    FormSelect,
    FormTextarea,
    FormFileUpload,
    Btn,
    MglMapComponent,
    MarkerComponent,
  ],
  templateUrl: './post-form.html',
  styleUrl: './post-form.scss',
})
export class PostForm implements OnInit, OnChanges {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() initialData?: PostDetail;
  @Input() existingMedia: PostMedia[] = [];

  @Output() formSubmit = new EventEmitter<PostFormData>();
  @Output() existingMediaRemove = new EventEmitter<string>();

  private fb = inject(FormBuilder);
  private mediaService = inject(MediaService);
  private dictionaryService = inject(DictionaryService);
  private geocodingService = inject(GeocodingService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  @ViewChild('formMap') mapComponent?: MglMapComponent;

  // Address search state
  addressSearchQuery = '';
  addressSuggestions: NominatimSearchResult[] = [];
  isSearchingAddress = false;
  hasSearched = false;

  // Map settings
  mapCenter: [number, number] = [18.6, 54.4]; // Gdańsk/Tricity center
  mapZoom: [number] = [12];

  private searchSubject = new Subject<string>();

  countryCodes$: Observable<CountryCode[]> = this.dictionaryService.getCountryCodes();

  countryCodeOptions: SelectOption[] = [];

  mediaPreviews: MediaPreview[] = [];
  newlyUploadedMedia: MediaResource[] = [];
  isSubmitting = false;

  typeOptions: SelectOption[] = [
    { value: 'ONLINE', label: '' },
    { value: 'OFFLINE', label: '' },
  ];

  visibilityOptions: SelectOption[] = [
    { value: 'PUBLIC', label: '' },
    { value: 'PRIVATE', label: '' },
    { value: 'FRIENDS', label: '' },
  ];

  // Form definition with validation matching API contract + DB schema
  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(128)]],
    type: ['ONLINE' as PostType, Validators.required],
    startsAt: ['', Validators.required],
    endsAt: [''],
    description: ['', [Validators.required, Validators.maxLength(1024)]],
    eventUrl: [''],
    tags: [''],
    visibility: ['PUBLIC' as PostVisibility, Validators.required],
    location: this.fb.group({
      countryCode: ['', [Validators.minLength(3), Validators.maxLength(3)]],
      venueName: ['', Validators.maxLength(64)],
      buildingNum: ['', Validators.maxLength(16)],
      street: ['', Validators.maxLength(128)],
      postalCode: ['', Validators.maxLength(16)],
      city: ['', Validators.maxLength(128)],
      coordinates: this.fb.group({
        latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
        longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
      }),
    }),
  });

  // FormControl getters for template
  get titleControl(): FormControl {
    return this.postForm.get('title') as FormControl;
  }
  get typeControl(): FormControl {
    return this.postForm.get('type') as FormControl;
  }
  get startsAtControl(): FormControl {
    return this.postForm.get('startsAt') as FormControl;
  }
  get endsAtControl(): FormControl {
    return this.postForm.get('endsAt') as FormControl;
  }
  get descriptionControl(): FormControl {
    return this.postForm.get('description') as FormControl;
  }
  get eventUrlControl(): FormControl {
    return this.postForm.get('eventUrl') as FormControl;
  }
  get tagsControl(): FormControl {
    return this.postForm.get('tags') as FormControl;
  }
  get visibilityControl(): FormControl {
    return this.postForm.get('visibility') as FormControl;
  }
  get countryCodeControl(): FormControl {
    return this.postForm.get('location.countryCode') as FormControl;
  }
  get cityControl(): FormControl {
    return this.postForm.get('location.city') as FormControl;
  }
  get postalCodeControl(): FormControl {
    return this.postForm.get('location.postalCode') as FormControl;
  }
  get streetControl(): FormControl {
    return this.postForm.get('location.street') as FormControl;
  }
  get buildingNumControl(): FormControl {
    return this.postForm.get('location.buildingNum') as FormControl;
  }
  get venueNameControl(): FormControl {
    return this.postForm.get('location.venueName') as FormControl;
  }
  get latitudeControl(): FormControl {
    return this.postForm.get('location.coordinates.latitude') as FormControl;
  }
  get longitudeControl(): FormControl {
    return this.postForm.get('location.coordinates.longitude') as FormControl;
  }

  get isOffline(): boolean {
    return this.postForm.get('type')?.value === 'OFFLINE';
  }

  get hasUploading(): boolean {
    return this.mediaPreviews.some((p) => p.isUploading);
  }

  ngOnInit(): void {
    // Load dictionaries, then re-patch form if initialData already arrived
    this.countryCodes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((codes) => {
      this.countryCodeOptions = codes.map((c) => ({ value: c.code, label: c.code }));
      // Re-sync select after options are available
      if (this.initialData?.location) {
        this.countryCodeControl.setValue(this.initialData.location.countryCode ?? '', {
          emitEvent: false,
        });
      }
    });

    // Subscribe to type changes for location validators
    this.postForm
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.toggleLocationValidators(type ?? 'ONLINE'));

    this.toggleLocationValidators(this.postForm.get('type')?.value ?? 'ONLINE');

    // Set translated labels for type/visibility
    this.updateTranslatedOptions();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateTranslatedOptions());

    // Autocomplete search subscription
    this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length < 3) {
            this.addressSuggestions = [];
            this.isSearchingAddress = false;
            this.hasSearched = false;
            this.cdr.markForCheck();
            return of([]);
          }
          this.isSearchingAddress = true;
          this.hasSearched = true;
          this.cdr.markForCheck();
          return this.geocodingService.search(query).pipe(
            catchError((err) => {
              console.error('Error searching address', err);
              this.isSearchingAddress = false;
              this.cdr.markForCheck();
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        this.addressSuggestions = results;
        this.isSearchingAddress = false;
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.patchFormFromPost(this.initialData);
    }
  }

  private updateTranslatedOptions(): void {
    this.typeOptions = [
      { value: 'ONLINE', label: this.translate.instant('POST_FORM.type-online') },
      { value: 'OFFLINE', label: this.translate.instant('POST_FORM.type-offline') },
    ];
    this.visibilityOptions = [
      { value: 'PUBLIC', label: this.translate.instant('POST_FORM.visibility-public') },
      { value: 'PRIVATE', label: this.translate.instant('POST_FORM.visibility-private') },
      { value: 'FRIENDS', label: this.translate.instant('POST_FORM.visibility-friends') },
    ];
  }

  private patchFormFromPost(post: PostDetail): void {
    const tagsStr = post.tags ? post.tags.join(', ') : '';

    this.postForm.patchValue({
      title: post.title,
      type: post.type,
      startsAt: post.startsAt ? post.startsAt.substring(0, 16) : '',
      endsAt: post.endsAt ? post.endsAt.substring(0, 16) : '',
      description: post.description,
      eventUrl: post.eventUrl ?? '',
      tags: tagsStr,
      visibility: post.visibility ?? 'PUBLIC',
      location: {
        countryCode: post.location?.countryCode ?? '',
        venueName: post.location?.venueName ?? '',
        buildingNum: post.location?.buildingNum ?? '',
        street: post.location?.street ?? '',
        postalCode: post.location?.postalCode ?? '',
        city: post.location?.city ?? '',
        coordinates: {
          latitude: post.location?.coordinates?.latitude ?? null,
          longitude: post.location?.coordinates?.longitude ?? null,
        },
      },
    });

    if (
      post.location?.coordinates?.latitude !== undefined &&
      post.location?.coordinates?.longitude !== undefined
    ) {
      const lat = post.location.coordinates.latitude;
      const lon = post.location.coordinates.longitude;
      if (lat !== null && lon !== null) {
        this.mapCenter = [lon, lat];
        this.mapZoom = [15];
        if (this.mapComponent?.mapInstance) {
          this.mapComponent.mapInstance.setCenter([lon, lat]);
          this.mapComponent.mapInstance.setZoom(15);
        }
        // Prefill addressSearchQuery in edit mode if address fields exist
        if (post.location?.city) {
          const parts = [
            post.location.venueName,
            post.location.street
              ? `${post.location.street} ${post.location.buildingNum || ''}`
              : '',
            post.location.city,
          ].filter(Boolean);
          this.addressSearchQuery = parts.join(', ');
        }
      }
    }

    this.toggleLocationValidators(post.type);
  }

  private toggleLocationValidators(type: PostType): void {
    const controls = [
      this.countryCodeControl,
      this.postalCodeControl,
      this.cityControl,
      this.latitudeControl,
      this.longitudeControl,
    ];

    if (controls.some((c) => !c)) return;

    if (type === 'OFFLINE') {
      this.countryCodeControl.addValidators(Validators.required);
      this.postalCodeControl.addValidators(Validators.required);
      this.cityControl.addValidators(Validators.required);
      this.latitudeControl.addValidators(Validators.required);
      this.longitudeControl.addValidators(Validators.required);
    } else {
      this.countryCodeControl.removeValidators(Validators.required);
      this.postalCodeControl.removeValidators(Validators.required);
      this.cityControl.removeValidators(Validators.required);
      this.latitudeControl.removeValidators(Validators.required);
      this.longitudeControl.removeValidators(Validators.required);
    }

    controls.forEach((c) => c.updateValueAndValidity({ emitEvent: false }));
  }

  async onFilesSelected(files: File[]): Promise<void> {
    for (const file of files) {
      const preview: MediaPreview = {
        file,
        previewUrl: URL.createObjectURL(file),
        isUploading: true,
      };
      this.mediaPreviews.push(preview);

      try {
        const initRes = await lastValueFrom(
          this.mediaService.initUpload({
            purpose: 'EVENT_MEDIA',
            mimeType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
          }),
        );

        await lastValueFrom(
          this.mediaService.uploadToS3(initRes.uploadUrl, file, initRes.requiredHeaders),
        );
        await lastValueFrom(this.mediaService.completeUpload(initRes.mediaId));

        preview.mediaId = initRes.mediaId;
        preview.isUploading = false;
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Error while loading file', file.name, err);
        this.mediaPreviews = this.mediaPreviews.filter((p) => p !== preview);
        this.cdr.detectChanges();
      }
    }
  }

  removeNewPreview(index: number): void {
    URL.revokeObjectURL(this.mediaPreviews[index].previewUrl);
    this.mediaPreviews.splice(index, 1);
  }

  removeExisting(mediaId: string): void {
    this.existingMediaRemove.emit(mediaId);
  }

  removeNewlyUploaded(mediaId: string): void {
    this.newlyUploadedMedia = this.newlyUploadedMedia.filter((m) => m.id !== mediaId);
  }

  onSubmit(): void {
    if (this.postForm.invalid || this.isSubmitting || this.hasUploading) {
      this.postForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.postForm.getRawValue();
    const isOffline = formValue.type === 'OFFLINE';

    // Collect all media IDs
    const existingIds = this.existingMedia.map((m) => m.media.id);
    const newPreviewIds = this.mediaPreviews.map((p) => p.mediaId!).filter(Boolean);
    const newlyUploadedIds = this.newlyUploadedMedia.map((m) => m.id);
    const allMediaIds = [...existingIds, ...newPreviewIds, ...newlyUploadedIds];

    // Parse tags from comma-separated string
    const tagsRaw = formValue.tags ?? '';
    const tags = tagsRaw
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 10)
      .map((t: string) => t.substring(0, 32));

    const data: PostFormData = {
      title: formValue.title ?? '',
      type: formValue.type ?? 'ONLINE',
      startsAt: formValue.startsAt ? new Date(formValue.startsAt).toISOString() : '',
      endsAt: formValue.endsAt ? new Date(formValue.endsAt).toISOString() : null,
      description: formValue.description ?? '',
      eventUrl: formValue.eventUrl || null,
      tags,
      visibility: (formValue.visibility as PostVisibility) ?? 'PUBLIC',
      location: isOffline
        ? {
            countryCode: formValue.location?.countryCode ?? '',
            venueName: formValue.location?.venueName || null,
            buildingNum: formValue.location?.buildingNum || null,
            street: formValue.location?.street || null,
            postalCode: formValue.location?.postalCode ?? '',
            city: formValue.location?.city ?? '',
            coordinates: {
              latitude: Number(formValue.location?.coordinates?.latitude),
              longitude: Number(formValue.location?.coordinates?.longitude),
            },
          }
        : null,
      mediaIds: allMediaIds,
      coverMediaId: allMediaIds.length > 0 ? allMediaIds[0] : null,
    };

    this.formSubmit.emit(data);
  }

  resetSubmitting(): void {
    this.isSubmitting = false;
  }

  resetForm(): void {
    this.postForm.reset({
      type: 'ONLINE',
      visibility: 'PUBLIC',
      location: {
        countryCode: '',
        venueName: '',
        buildingNum: '',
        street: '',
        postalCode: '',
        city: '',
        coordinates: { latitude: null, longitude: null },
      },
    });
    this.mediaPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    this.mediaPreviews = [];
    this.newlyUploadedMedia = [];
    this.addressSearchQuery = '';
    this.addressSuggestions = [];
    this.isSearchingAddress = false;
    this.hasSearched = false;
    this.mapCenter = [18.6, 54.4];
    this.mapZoom = [12];
    this.isSubmitting = false;
  }

  onAddressSearchInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.addressSearchQuery = inputEl.value;
    this.searchSubject.next(inputEl.value);
  }

  selectAddress(suggestion: NominatimSearchResult): void {
    const address = suggestion.address || {};
    const city = address.city || address.town || address.village || address.municipality || '';
    const street = address.road || '';
    const postcode = address.postcode || '';
    const country2Letter = address.country_code || '';
    const countryCode = this.geocodingService.mapCountryCode(country2Letter);
    const houseNumber = address.house_number || '';

    const lat = Number(suggestion.lat);
    const lon = Number(suggestion.lon);

    // Patch fields in form
    this.postForm.patchValue({
      location: {
        countryCode,
        city,
        postalCode: postcode,
        street,
        buildingNum: houseNumber,
        coordinates: {
          latitude: lat,
          longitude: lon,
        },
      },
    });

    this.postForm.get('location.coordinates')?.markAsDirty();
    this.postForm.get('location')?.markAsDirty();

    // Clear suggestions
    this.addressSuggestions = [];
    this.addressSearchQuery = suggestion.display_name;
    this.hasSearched = false;

    // Center map on the selected address
    this.mapCenter = [lon, lat];
    this.mapZoom = [15];
    if (this.mapComponent?.mapInstance) {
      this.mapComponent.mapInstance.flyTo({
        center: [lon, lat],
        zoom: 15,
        duration: 800,
      });
    }

    this.cdr.markForCheck();
  }

  onMapClick(event: MapMouseEvent): void {
    const lat = event.lngLat.lat;
    const lon = event.lngLat.lng;

    // Update coordinate fields
    this.postForm.patchValue({
      location: {
        coordinates: {
          latitude: lat,
          longitude: lon,
        },
      },
    });

    this.postForm.get('location.coordinates')?.markAsDirty();

    // Call reverse geocoding to pre-fill address details
    this.isSearchingAddress = true;
    this.cdr.markForCheck();
    this.geocodingService
      .reverse(lat, lon)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isSearchingAddress = false;
          if (result && result.address) {
            const address = result.address;
            const city =
              address.city || address.town || address.village || address.municipality || '';
            const street = address.road || '';
            const postcode = address.postcode || '';
            const country2Letter = address.country_code || '';
            const countryCode = this.geocodingService.mapCountryCode(country2Letter);
            const houseNumber = address.house_number || '';

            // Update remaining fields on pin/map selection
            this.postForm.patchValue({
              location: {
                countryCode: countryCode || '',
                city: city || '',
                postalCode: postcode || '',
                street: street || '',
                buildingNum: houseNumber || '',
              },
            });

            // Set search query input value to display name
            this.addressSearchQuery = result.display_name;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error reverse geocoding coordinates', err);
          this.isSearchingAddress = false;
          this.cdr.markForCheck();
        },
      });
  }

  onFormMapLoad(map: maplibregl.Map): void {
    // If edit mode and already have coordinates, center map there
    const lat = this.latitudeControl.value;
    const lon = this.longitudeControl.value;
    if (lat !== null && lon !== null) {
      this.mapCenter = [lon, lat];
      this.mapZoom = [15];
      map.setCenter([lon, lat]);
      map.setZoom(15);
    }
  }

  closeSuggestions(): void {
    setTimeout(() => {
      this.addressSuggestions = [];
      this.cdr.markForCheck();
    }, 250);
  }
}
