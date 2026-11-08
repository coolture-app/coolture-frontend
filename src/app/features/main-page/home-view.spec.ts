import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HomeView, HomeViewMemory, NO_FILTERS } from './home-view';
import { PostListStore } from '../../core/services/post-list/post-list.store';

const VIEW: HomeView = {
  search: 'jazz',
  filters: NO_FILTERS,
  pickedSort: null,
  showFilters: false,
  isMapView: false,
  scrollY: 1200,
};

describe('HomeViewMemory', () => {
  let memory: HomeViewMemory;
  let list: PostListStore;
  let http: HttpTestingController;

  beforeEach(() => {
    jasmine.clock().install().mockDate(new Date('2026-11-04T12:00:00Z'));
    memory = TestBed.inject(HomeViewMemory);
    list = TestBed.inject(PostListStore);
    http = TestBed.inject(HttpTestingController);
    list.start({ kind: 'feed' });
  });

  afterEach(() => {
    http.match(() => true);
    jasmine.clock().uninstall();
  });

  it('gives the view back within 30 minutes', () => {
    memory.save(VIEW);
    jasmine.clock().tick(29 * 60 * 1000);

    expect(memory.restore()).toEqual(VIEW);
  });

  it('expires after 30 minutes', () => {
    memory.save(VIEW);
    jasmine.clock().tick(30 * 60 * 1000);

    expect(memory.restore()).toBeNull();
  });

  it('has nothing to give back once a new list starts', () => {
    memory.save(VIEW);

    list.start({ kind: 'feed' });

    expect(memory.restore()).toBeNull();
  });

  it('has nothing to give back once the list is cleared, as when the user changes', () => {
    memory.save(VIEW);

    list.clear();

    expect(memory.restore()).toBeNull();
  });
});
