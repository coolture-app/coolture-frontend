import { Component } from '@angular/core';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import { MarkerComponent, PopupComponent } from '@maplibre/ngx-maplibre-gl';

import { MapMarker } from '../map-marker/map-marker';
import { MapPopup } from '../map-popup/map-popup';

@Component({
  selector: 'app-map',
  imports: [MapComponent, MapMarker, MarkerComponent, PopupComponent, MapPopup],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class Map {
  mapStyle = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';
  centerCoords: [number, number] = [18.23, 54.6];
  zoomLevel: [number] = [12];
  //TODO WGS
}
