import { FormControl, FormGroup, Validators } from '@angular/forms';
import { GeoPoint } from '../../models/common/geo.model';
import { LOCATION_LIMITS } from '../../models/common/location-limits';

const NOT_BLANK = Validators.pattern(/\S/);

/** The place of an in-person post. Only the city and the pin are required. */
export function locationForm() {
  const text = (max: number, required = false) =>
    new FormControl('', {
      nonNullable: true,
      validators: required
        ? [Validators.required, NOT_BLANK, Validators.maxLength(max)]
        : Validators.maxLength(max),
    });
  return new FormGroup({
    venueName: text(LOCATION_LIMITS.venueName),
    street: text(LOCATION_LIMITS.street),
    buildingNum: text(LOCATION_LIMITS.buildingNum),
    postalCode: text(LOCATION_LIMITS.postalCode),
    city: text(LOCATION_LIMITS.city, true),
    countryCode: new FormControl<string | null>(null),
    coordinates: new FormControl<GeoPoint | null>(null, Validators.required),
  });
}

export type LocationForm = ReturnType<typeof locationForm>;
