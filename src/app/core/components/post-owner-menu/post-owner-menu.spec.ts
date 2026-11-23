import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { PostOwnerMenu } from './post-owner-menu';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { ToastService } from '../../services/toast/toast.service';

describe('PostOwnerMenu', () => {
  let fixture: ComponentFixture<PostOwnerMenu>;
  let http: HttpTestingController;
  const element = () => fixture.nativeElement as HTMLElement;
  const items = () => [...element().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];

  beforeEach(() => {
    fixture = TestBed.createComponent(PostOwnerMenu);
    fixture.componentRef.setInput('postId', 'p1');
    fixture.componentRef.setInput('postTitle', 'Koncert');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  function openMenu(): void {
    element().querySelector<HTMLButtonElement>('.owner__toggle')!.click();
    fixture.detectChanges();
  }

  it('opens with Edytuj and Usuń', () => {
    openMenu();

    expect(items().map((b) => b.textContent?.trim())).toEqual(['POST.edit', 'POST.delete']);
  });

  it('opens the edit page', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    openMenu();
    items()[0].click();

    expect(navigate).toHaveBeenCalledWith(['/posts', 'p1', 'edit']);
  });

  it('deletes only after the confirmation, naming the post', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const deleted: string[] = [];
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));

    openMenu();
    items()[1].click();
    expect(confirm.request()?.params).toEqual({ title: 'Koncert' });
    confirm.answer('cancel');
    await fixture.whenStable();
    http.expectNone(() => true);

    openMenu();
    items()[1].click();
    confirm.answer('confirm');
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/posts/p1')).flush(null);

    expect(deleted).toEqual(['p1']);
  });

  it('says so when the delete fails', async () => {
    openMenu();
    items()[1].click();
    TestBed.inject(ConfirmService).answer('confirm');
    await new Promise((resolve) => setTimeout(resolve));
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(TestBed.inject(ToastService).message()).toBe('POST.deleteFailed');
  });
});
