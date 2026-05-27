import { Component, input } from '@angular/core';

@Component({
  selector: 'app-map-marker',
  templateUrl: './map-marker.html',
  styleUrls: ['./map-marker.scss'],
})
export class MapMarker {
  coverImageUrl = input<string | null>(null);
  clusterCount = input<number | undefined>();
  isCluster = input<boolean>(false);
}
