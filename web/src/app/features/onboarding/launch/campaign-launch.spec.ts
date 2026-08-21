import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignLaunch } from './campaign-launch';
import { OnboardingService } from '../services/onboarding.service';
import { ConfirmDialogService } from '../../../shared/ui';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  ActivatedCampaign,
  CampaignFormInput,
  CampaignPreview,
  CampaignTemplateList,
  CreatedCampaign,
} from '../services/onboarding.model';

/**
 * Story: creating a campaign and starting its spend are two separate acts, and
 * this file is the proof.
 *
 * Story 5.5's activation had zero call sites — the only button in the flow
 * submitted the create action, so every campaign launched through the app
 * stayed paused in Meta indefinitely while the story read as Done. The fix is
 * not to merge them; that trades a stuck campaign for a form submit that
 * quietly spends a client's money. So:
 *
 *  - review() validates and creates nothing.
 *  - create() creates a PAUSED campaign and does not activate it.
 *  - activate() is a second click, behind a confirmation whose copy is the
 *    server's own warning string, and it does not fire when that is declined.
 */

const WARNING =
  "Activating starts real ad spend on this client's Meta ad account immediately. " +
  'The campaign is created paused; nothing spends until this step.';

const TEMPLATES: CampaignTemplateList = {
  templates: [
    {
      id: 'tax-return-prep',
      offerLabel: 'Tax return prep',
      adSetTargeting: 'US, 30-65, homeowners',
      creatives: [{ id: 'trp-1' }],
    },
  ],
  activationWarning: WARNING,
};

const PREVIEW: CampaignPreview = {
  campaign: {
    clientName: 'Acme Tax',
    offerId: 'tax-return-prep',
    monthlyBudget: 3000,
    dailyCap: 90,
    pixelId: 'px-1',
  },
  template: TEMPLATES.templates[0],
  activationWarning: WARNING,
};

const CREATED: CreatedCampaign = {
  campaignId: 'camp-1',
  adSetId: 'adset-1',
  adIds: ['ad-1'],
  status: 'paused',
  activated: false,
  locationId: 'loc1',
  activationWarning: WARNING,
};

const ACTIVATED: ActivatedCampaign = {
  campaignId: 'camp-1',
  opportunityId: 'opp-1',
  stageId: 'stage-2',
  stageName: 'AP 2 - Ads Launched',
  activated: true,
};

const templates = vi.fn<() => Promise<ApiResult<CampaignTemplateList>>>();
const preview = vi.fn<(input: CampaignFormInput) => Promise<ApiResult<CampaignPreview>>>();
const create =
  vi.fn<(input: CampaignFormInput, locationId?: string) => Promise<ApiResult<CreatedCampaign>>>();
const activate =
  vi.fn<(campaignId: string, locationId?: string) => Promise<ApiResult<ActivatedCampaign>>>();
const confirm = vi.fn<() => Promise<boolean>>();

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  templates.mockReset();
  preview.mockReset();
  create.mockReset();
  activate.mockReset();
  confirm.mockReset();

  templates.mockResolvedValue(ok(TEMPLATES));
  preview.mockResolvedValue(ok(PREVIEW));
  create.mockResolvedValue(ok(CREATED));
  activate.mockResolvedValue(ok(ACTIVATED));
  confirm.mockResolvedValue(true);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CampaignLaunch],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: OnboardingService,
        useValue: { templates, preview, create, activate },
      },
      { provide: ConfirmDialogService, useValue: { confirm } },
    ],
  });

  const fixture = TestBed.createComponent(CampaignLaunch);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  const component = fixture.componentInstance;
  component['form'].setValue({
    client: '  Acme Tax  ',
    offer: 'tax-return-prep',
    budget: '3000',
    cap: '90',
    pixel: '  px-1  ',
  });

  return { fixture, component };
}

describe('CampaignLaunch', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reviews without creating anything', async () => {
    const { component } = await setup();

    await component['review']();

    expect(preview).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(component['step']()).toBe('review');
  });

  it('trims what the person typed before validating it', async () => {
    const { component } = await setup();

    await component['review']();

    expect(preview).toHaveBeenCalledWith({
      client: 'Acme Tax',
      offer: 'tax-return-prep',
      budget: '3000',
      cap: '90',
      pixel: 'px-1',
    });
  });

  it('shows the server’s own validation wording, which is the only actionable version', async () => {
    const { component } = await setup();
    preview.mockResolvedValue({
      data: null,
      error: {
        message: "Daily cap can't exceed monthly budget ÷ 30.",
        context: 'POST /api/onboarding/campaign-launch/preview',
        status: 400,
      },
    });

    await component['review']();

    expect(component['actionError']()).toBe("Daily cap can't exceed monthly budget ÷ 30.");
    expect(component['step']()).toBe('form');
  });

  it('CREATES A PAUSED CAMPAIGN and does not activate it', async () => {
    // The defect, stated as a test.
    const { component } = await setup();

    await component['review']();
    await component['create']();

    expect(create).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(component['created']()?.status).toBe('paused');
    expect(component['created']()?.activated).toBe(false);
    expect(component['activated']()).toBeNull();
    expect(component['step']()).toBe('created');
  });

  it('shows the server’s activation warning verbatim on the confirm step', async () => {
    const { component } = await setup();

    await component['review']();
    await component['create']();

    expect(component['activationWarning']()).toBe(WARNING);
    expect(component['activationWarning']()).toContain('real ad spend');
  });

  it('does not spend a penny when the confirmation is declined', async () => {
    const { component } = await setup();
    confirm.mockResolvedValue(false);

    await component['review']();
    await component['create']();
    await component['activate']();

    expect(activate).not.toHaveBeenCalled();
    expect(component['activated']()).toBeNull();
  });

  it('confirms with the server’s wording, not a local paraphrase', async () => {
    const { component } = await setup();

    await component['review']();
    await component['create']();
    await component['activate']();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: WARNING, destructive: true }),
    );
  });

  it('activates the campaign it created, for the location it was created in', async () => {
    const { component } = await setup();

    await component['review']();
    await component['create']();
    await component['activate']();

    expect(activate).toHaveBeenCalledWith('camp-1', 'loc1');
    expect(component['activated']()?.stageName).toBe('AP 2 - Ads Launched');
  });

  it('cannot activate twice — a second click is a second spend decision', async () => {
    const { component } = await setup();

    await component['review']();
    await component['create']();
    await component['activate']();
    await component['activate']();

    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('cannot create twice from one review, which would be a second campaign in Meta', async () => {
    const { component } = await setup();

    await component['review']();
    await component['create']();
    await component['create']();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('surfaces a partial activation failure verbatim, so nobody relaunches a live campaign', async () => {
    const { component } = await setup();
    activate.mockResolvedValue({
      data: null,
      error: {
        message:
          'The campaign IS live on Meta, but the Fulfillment stage move failed. Retry the stage move only.',
        context: 'POST /api/onboarding/campaign-launch/activate',
        status: 500,
      },
    });

    await component['review']();
    await component['create']();
    await component['activate']();

    expect(component['actionError']()).toContain('IS live on Meta');
    expect(component['activated']()).toBeNull();
  });

  it('will not review until every field has something in it', async () => {
    const { fixture, component } = await setup();

    component['form'].patchValue({ pixel: '   ' });
    fixture.detectChanges();
    expect(component['canReview']()).toBe(false);

    component['form'].patchValue({ pixel: 'px-1' });
    fixture.detectChanges();
    expect(component['canReview']()).toBe(true);
  });

  it('goes back to the form on Edit, dropping the stale review', async () => {
    const { component } = await setup();

    await component['review']();
    component['edit']();

    expect(component['step']()).toBe('form');
    expect(component['preview']()).toBeNull();
  });
});
