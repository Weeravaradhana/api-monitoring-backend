import { MonitorEngineExecutor } from './monitor-engine.executor';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

describe('MonitorEngineExecutor (Unit Test)', () => {
  let executor: MonitorEngineExecutor;
  let httpService: HttpService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    $transaction: jest.fn().mockResolvedValue([{}, {}]),
    monitoringResult: { create: jest.fn().mockResolvedValue({}) },
    monitor: { update: jest.fn().mockResolvedValue({}) },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockHttpService = {
    request: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorEngineExecutor,
        { provide: HttpService, useValue: mockHttpService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    executor = module.get(MonitorEngineExecutor);
    httpService = module.get(HttpService);
    eventEmitter = module.get(EventEmitter2);

    jest.clearAllMocks();
  });

  it("should successfully monitor an UP website and should NOT emit event if state hasn't changed", async () => {
    const mockMonitor: any = {
      id: 'monitor-uuid-123',
      name: 'Google Test',
      url: 'https://google.com',
      method: 'GET',
      timeout: 5,
      interval: 60,
      headers: {},
      body: null,
      lastState: 'UP',
      user: { email: 'pabasara@test.com' },
    };

    const mockResponse: AxiosResponse = {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} as any },
    };
    mockHttpService.request.mockReturnValue(of(mockResponse));

    await executor.executeJob(mockMonitor);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should detect state change and emit monitor.down when website fails with 500 status', async () => {
    const mockMonitor: any = {
      id: 'monitor-uuid-456',
      name: 'Broken Site Test',
      url: 'https://brokensite.xyz',
      method: 'GET',
      timeout: 5,
      interval: 60,
      headers: {},
      body: null,
      lastState: 'UP',
      user: { email: 'pabasara@test.com' },
    };

    const mockResponse: AxiosResponse = {
      data: {},
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: {} as any },
    };
    mockHttpService.request.mockReturnValue(of(mockResponse));

    await executor.executeJob(mockMonitor);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'monitor.down',
      expect.objectContaining({
        monitorId: 'monitor-uuid-456',
        statusCode: 500,
        userEmail: 'pabasara@test.com',
      }),
    );
  });

  it('should emit monitor.down when network error occurs (e.g. Connection Refused)', async () => {
    const mockMonitor: any = {
      id: 'monitor-uuid-789',
      name: 'Network Failure Test',
      url: 'https://nonexistent-domain.com',
      method: 'GET',
      timeout: 5,
      interval: 60,
      headers: {},
      body: null,
      lastState: 'UP',
      user: { email: 'pabasara@test.com' },
    };

    const mockAxiosError = {
      isAxiosError: true,
      message: 'connect ECONNREFUSED',
      response: undefined,
    };
    mockHttpService.request.mockReturnValue(throwError(() => mockAxiosError));

    await executor.executeJob(mockMonitor);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'monitor.down',
      expect.objectContaining({
        monitorId: 'monitor-uuid-789',
        statusCode: null,
        errorMessage: 'connect ECONNREFUSED',
      }),
    );
  });
});
