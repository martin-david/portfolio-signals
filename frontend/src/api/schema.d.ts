/**
 * Generated from openapi/v1.json by scripts/generate-api-types.mjs (openapi-typescript).
 * Do not edit by hand: refresh the spec with `npm run api:fetch`, then run `npm run api:generate`.
 */

export type paths = {
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Me_Get"];
        put: operations["Me_Put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Integrations_List"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["Integrations_Connect"];
        post?: never;
        delete: operations["Integrations_Disconnect"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Sync_RequestSync"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Sync_Runs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/portfolio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Portfolio_Latest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/portfolio/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Portfolio_Snapshots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/portfolio/analysis": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Portfolio_Analysis"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/portfolio/holdings/{symbol}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Portfolio_Holding"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        AccountSummary: {
            currency: string;
            /** Format: double */
            totalValue: number;
            /** Format: double */
            directValue: number;
            /** Format: double */
            copiedValue: number;
            /** Format: double */
            availableCash: number;
            /** Format: double */
            unrealizedPnl: number;
            /** Format: double */
            usedMargin: number;
        };
        AiAnalysis: {
            /** Format: double */
            score: null | number;
            rating: null | string;
            /** Format: double */
            priceTarget: null | number;
            /** Format: double */
            upsidePct: null | number;
            /** Format: date */
            asOf: null | string;
        };
        AnalystBreadth: {
            /** Format: int32 */
            analysts: number;
            /** Format: int32 */
            buy: number;
            /** Format: int32 */
            hold: number;
            /** Format: int32 */
            sell: number;
            /** Format: int32 */
            withPriceTarget: number;
            /** Format: double */
            priceTargetMin: null | number;
            /** Format: double */
            priceTargetMedian: null | number;
            /** Format: double */
            priceTargetMax: null | number;
        };
        /** @enum {unknown} */
        AnalystConsensus: "StrongSell" | "Sell" | "Neutral" | "Buy" | "StrongBuy" | null;
        AnalyzedHoldingDto: {
            holding: components["schemas"]["HoldingDto"];
            assessment: components["schemas"]["HoldingAssessment"];
        };
        AssessmentFacts: {
            consensus: null | components["schemas"]["AnalystConsensus"];
            /** Format: double */
            priceTarget: null | number;
            /** Format: double */
            lastPrice: null | number;
            currency: null | string;
            /** Format: double */
            streetUpsidePct: null | number;
            /** Format: int32 */
            smartScore: null | number;
            /** Format: double */
            aiScore: null | number;
            /** Format: double */
            aiUpsidePct: null | number;
            /** Format: date */
            nextEarningsDate: null | string;
            /** Format: int32 */
            daysToEarnings: null | number;
            /** Format: int32 */
            analystCount: null | number;
        };
        AssessmentFlag: {
            key: string;
            severity: components["schemas"]["FlagSeverity"];
            title: string;
            detail: string;
        };
        /** @enum {unknown} */
        AssetClass: "Stock" | "Etf" | "Crypto" | "Other";
        ConnectProviderRequest: {
            credentials: {
                [key: string]: string;
            };
        };
        /** @enum {unknown} */
        ConnectionStatus: "Active" | "CredentialsRejected" | "Disconnected" | null;
        CopiedTrader: {
            /** Format: int64 */
            mirrorId: number;
            /** Format: double */
            invested: number;
            /** Format: double */
            value: number;
            /** Format: double */
            openPnl: number;
            /** Format: double */
            openPnlPct: number;
            /** Format: double */
            closedPnl: number;
            /** Format: double */
            availableCash: number;
            /** Format: double */
            valuePct: number;
            /** Format: double */
            stopLossPct: number;
        };
        /** @enum {unknown} */
        FlagSeverity: "Info" | "Warn" | "Alert";
        HoldingAssessment: {
            symbol: string;
            tipRanksTicker: string;
            /** Format: double */
            weightPct: number;
            material: boolean;
            components: components["schemas"]["SignalComponents"];
            /** Format: int32 */
            composite: null | number;
            tier: components["schemas"]["Tier"];
            verdict: components["schemas"]["Verdict"];
            facts: components["schemas"]["AssessmentFacts"];
            flags: components["schemas"]["AssessmentFlag"][];
            viaTicker: null | string;
        };
        HoldingDetailDto: {
            analysis: components["schemas"]["AnalyzedHoldingDto"];
            signals: null | components["schemas"]["SignalData"];
            /** Format: date-time */
            signalsFetchedAt: null | string;
        };
        HoldingDto: {
            /** Format: int32 */
            instrumentId: number;
            symbol: string;
            name: string;
            assetClass: components["schemas"]["AssetClass"];
            tipRanksTicker: string;
            /** Format: double */
            invested: number;
            /** Format: double */
            value: number;
            /** Format: double */
            weightPct: number;
            /** Format: double */
            pnl: number;
            /** Format: double */
            pnlPct: number;
            /** Format: double */
            units: number;
            /** Format: double */
            avgOpenRate: number;
            /** Format: double */
            avgLeverage: number;
        };
        IntegrationDto: {
            provider: components["schemas"]["IntegrationProvider"];
            status: null | components["schemas"]["ConnectionStatus"];
            /** Format: int32 */
            syncIntervalMinutes: number;
            /** Format: date-time */
            connectedAt: null | string;
            /** Format: date-time */
            lastAttemptAt: null | string;
            /** Format: date-time */
            lastSuccessfulSyncAt: null | string;
            /** Format: date-time */
            nextSyncDueAt: null | string;
            lastFailure: null | components["schemas"]["SyncFailure"];
            requiredCredentialFields: string[];
        };
        /** @enum {unknown} */
        IntegrationProvider: "Etoro" | "TipRanks";
        PortfolioAnalysisDto: {
            snapshotId: string;
            /** Format: date-time */
            asOf: string;
            /** Format: date-time */
            signalsFetchedAt: null | string;
            kpis: components["schemas"]["PortfolioKpis"];
            holdings: components["schemas"]["AnalyzedHoldingDto"][];
            disclaimer: string;
        };
        PortfolioDto: {
            snapshotId: string;
            /** Format: date-time */
            takenAt: string;
            /** Format: date-time */
            lastSuccessfulSyncAt: null | string;
            account: components["schemas"]["AccountSummary"];
            holdings: components["schemas"]["HoldingDto"][];
            copiedTraders: components["schemas"]["CopiedTrader"][];
        };
        PortfolioKpis: {
            /** Format: double */
            totalValue: number;
            /** Format: double */
            directValue: number;
            /** Format: double */
            unrealizedPnl: number;
            /** Format: int32 */
            positions: number;
            /** Format: double */
            top1Pct: number;
            /** Format: double */
            top5Pct: number;
            /** Format: double */
            effectivePositions: number;
            /** Format: double */
            weightedSmartScore: null | number;
            /** Format: double */
            weightedStreetUpsidePct: null | number;
            /** Format: double */
            earnings30DaysPct: number;
            earnings30DaysSymbols: string[];
            smallPositions: components["schemas"]["SmallPositions"];
            verdictCounts: {
                [key: string]: number;
            };
        };
        PortfolioSnapshotSummaryDto: {
            snapshotId: string;
            /** Format: date-time */
            takenAt: string;
            /** Format: double */
            totalValue: number;
            /** Format: int32 */
            positions: number;
        };
        ProblemDetails: {
            type?: null | string;
            title?: null | string;
            /** Format: int32 */
            status?: null | number;
            detail?: null | string;
            instance?: null | string;
        };
        RequestSyncRequest: {
            provider: null | components["schemas"]["IntegrationProvider"];
        };
        SignalComponents: {
            /** Format: double */
            consensus: null | number;
            /** Format: double */
            upside: null | number;
            /** Format: double */
            smartScore: null | number;
            /** Format: double */
            aiScore: null | number;
            /** Format: double */
            technicals: null | number;
            /** Format: double */
            breadth: null | number;
        };
        SignalData: {
            companyName?: null | string;
            sector?: null | string;
            consensus?: null | components["schemas"]["AnalystConsensus"];
            bestAnalystConsensus?: null | components["schemas"]["AnalystConsensus"];
            /** Format: double */
            priceTarget?: null | number;
            /** Format: double */
            lastPrice?: null | number;
            currency?: null | string;
            /** Format: int32 */
            smartScore?: null | number;
            /** Format: double */
            peRatio?: null | number;
            /** Format: double */
            dividendYieldPct?: null | number;
            /** Format: double */
            newsSentiment?: null | number;
            /** Format: double */
            hedgeFundsScore?: null | number;
            /** Format: double */
            insiderScore?: null | number;
            /** Format: double */
            ytdGainPct?: null | number;
            /** Format: double */
            yearlyGainPct?: null | number;
            /** Format: date */
            nextEarningsDate?: null | string;
            ai?: null | components["schemas"]["AiAnalysis"];
            breadth?: null | components["schemas"]["AnalystBreadth"];
            technicalDay?: null | components["schemas"]["AnalystConsensus"];
            technicalWeek?: null | components["schemas"]["AnalystConsensus"];
        };
        SmallPositions: {
            /** Format: int32 */
            count: number;
            /** Format: double */
            value: number;
            /** Format: double */
            pct: number;
        };
        /** @enum {unknown} */
        SubscriptionPlan: "Free" | "Essential" | "Pro" | "Premium";
        SyncFailure: {
            kind: components["schemas"]["SyncFailureKind"];
            message: string;
            /** Format: date-time */
            at: string;
        };
        /** @enum {unknown} */
        SyncFailureKind: "Unauthorized" | "RateLimited" | "Unavailable" | "InvalidResponse" | "Unknown";
        SyncRunDto: {
            id: string;
            provider: components["schemas"]["IntegrationProvider"];
            trigger: components["schemas"]["SyncTrigger"];
            status: components["schemas"]["SyncRunStatus"];
            /** Format: date-time */
            requestedAt: string;
            /** Format: date-time */
            startedAt: null | string;
            /** Format: date-time */
            completedAt: null | string;
            /** Format: int32 */
            itemsProcessed: number;
            failure: null | components["schemas"]["SyncFailure"];
            skipReason: null | string;
        };
        /** @enum {unknown} */
        SyncRunStatus: "Queued" | "Running" | "Succeeded" | "Failed" | "Skipped";
        /** @enum {unknown} */
        SyncTrigger: "Scheduled" | "Manual";
        /** @enum {unknown} */
        Tier: "NoData" | "Weak" | "Mixed" | "Supported" | "Strong";
        UpdateProfileRequest: {
            displayName: null | string;
            email: null | string;
        };
        UserProfileDto: {
            id: string;
            email: string;
            displayName: string;
            plan: components["schemas"]["SubscriptionPlan"];
            /** Format: int32 */
            etoroSyncIntervalMinutes: number;
            /** Format: int32 */
            tipRanksSyncIntervalMinutes: number;
            allowsManualSync: boolean;
            /** Format: date-time */
            registeredAt: string;
        };
        ValidationProblemDetails: {
            type?: null | string;
            title?: null | string;
            /** Format: int32 */
            status?: null | number;
            detail?: null | string;
            instance?: null | string;
            errors?: {
                [key: string]: string[];
            };
        };
        /** @enum {unknown} */
        Verdict: "Hold" | "HoldReviewSize" | "Watch" | "Review" | "NoData";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type AccountSummary = components['schemas']['AccountSummary'];
export type AiAnalysis = components['schemas']['AiAnalysis'];
export type AnalystBreadth = components['schemas']['AnalystBreadth'];
export type AnalystConsensus = components['schemas']['AnalystConsensus'];
export type AnalyzedHoldingDto = components['schemas']['AnalyzedHoldingDto'];
export type AssessmentFacts = components['schemas']['AssessmentFacts'];
export type AssessmentFlag = components['schemas']['AssessmentFlag'];
export type AssetClass = components['schemas']['AssetClass'];
export type ConnectProviderRequest = components['schemas']['ConnectProviderRequest'];
export type ConnectionStatus = components['schemas']['ConnectionStatus'];
export type CopiedTrader = components['schemas']['CopiedTrader'];
export type FlagSeverity = components['schemas']['FlagSeverity'];
export type HoldingAssessment = components['schemas']['HoldingAssessment'];
export type HoldingDetailDto = components['schemas']['HoldingDetailDto'];
export type HoldingDto = components['schemas']['HoldingDto'];
export type IntegrationDto = components['schemas']['IntegrationDto'];
export type IntegrationProvider = components['schemas']['IntegrationProvider'];
export type PortfolioAnalysisDto = components['schemas']['PortfolioAnalysisDto'];
export type PortfolioDto = components['schemas']['PortfolioDto'];
export type PortfolioKpis = components['schemas']['PortfolioKpis'];
export type PortfolioSnapshotSummaryDto = components['schemas']['PortfolioSnapshotSummaryDto'];
export type ProblemDetails = components['schemas']['ProblemDetails'];
export type RequestSyncRequest = components['schemas']['RequestSyncRequest'];
export type SignalComponents = components['schemas']['SignalComponents'];
export type SignalData = components['schemas']['SignalData'];
export type SmallPositions = components['schemas']['SmallPositions'];
export type SubscriptionPlan = components['schemas']['SubscriptionPlan'];
export type SyncFailure = components['schemas']['SyncFailure'];
export type SyncFailureKind = components['schemas']['SyncFailureKind'];
export type SyncRunDto = components['schemas']['SyncRunDto'];
export type SyncRunStatus = components['schemas']['SyncRunStatus'];
export type SyncTrigger = components['schemas']['SyncTrigger'];
export type Tier = components['schemas']['Tier'];
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest'];
export type UserProfileDto = components['schemas']['UserProfileDto'];
export type ValidationProblemDetails = components['schemas']['ValidationProblemDetails'];
export type Verdict = components['schemas']['Verdict'];
export type $defs = Record<string, never>;
export interface operations {
    Me_Get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["UserProfileDto"];
                    "application/json": components["schemas"]["UserProfileDto"];
                    "text/json": components["schemas"]["UserProfileDto"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Me_Put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProfileRequest"];
                "text/json": components["schemas"]["UpdateProfileRequest"];
                "application/*+json": components["schemas"]["UpdateProfileRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["UserProfileDto"];
                    "application/json": components["schemas"]["UserProfileDto"];
                    "text/json": components["schemas"]["UserProfileDto"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ValidationProblemDetails"];
                    "application/json": components["schemas"]["ValidationProblemDetails"];
                    "text/json": components["schemas"]["ValidationProblemDetails"];
                };
            };
        };
    };
    Integrations_List: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["IntegrationDto"][];
                    "application/json": components["schemas"]["IntegrationDto"][];
                    "text/json": components["schemas"]["IntegrationDto"][];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Integrations_Connect: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: components["schemas"]["IntegrationProvider"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConnectProviderRequest"];
                "text/json": components["schemas"]["ConnectProviderRequest"];
                "application/*+json": components["schemas"]["ConnectProviderRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["IntegrationDto"];
                    "application/json": components["schemas"]["IntegrationDto"];
                    "text/json": components["schemas"]["IntegrationDto"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ValidationProblemDetails"];
                    "application/json": components["schemas"]["ValidationProblemDetails"];
                    "text/json": components["schemas"]["ValidationProblemDetails"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Integrations_Disconnect: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: components["schemas"]["IntegrationProvider"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Sync_RequestSync: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": null | components["schemas"]["RequestSyncRequest"];
                "text/json": null | components["schemas"]["RequestSyncRequest"];
                "application/*+json": null | components["schemas"]["RequestSyncRequest"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["SyncRunDto"][];
                    "application/json": components["schemas"]["SyncRunDto"][];
                    "text/json": components["schemas"]["SyncRunDto"][];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Sync_Runs: {
        parameters: {
            query?: {
                take?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["SyncRunDto"][];
                    "application/json": components["schemas"]["SyncRunDto"][];
                    "text/json": components["schemas"]["SyncRunDto"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ValidationProblemDetails"];
                    "application/json": components["schemas"]["ValidationProblemDetails"];
                    "text/json": components["schemas"]["ValidationProblemDetails"];
                };
            };
        };
    };
    Portfolio_Latest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["PortfolioDto"];
                    "application/json": components["schemas"]["PortfolioDto"];
                    "text/json": components["schemas"]["PortfolioDto"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Portfolio_Snapshots: {
        parameters: {
            query?: {
                take?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["PortfolioSnapshotSummaryDto"][];
                    "application/json": components["schemas"]["PortfolioSnapshotSummaryDto"][];
                    "text/json": components["schemas"]["PortfolioSnapshotSummaryDto"][];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ValidationProblemDetails"];
                    "application/json": components["schemas"]["ValidationProblemDetails"];
                    "text/json": components["schemas"]["ValidationProblemDetails"];
                };
            };
        };
    };
    Portfolio_Analysis: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["PortfolioAnalysisDto"];
                    "application/json": components["schemas"]["PortfolioAnalysisDto"];
                    "text/json": components["schemas"]["PortfolioAnalysisDto"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    Portfolio_Holding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                symbol: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["HoldingDetailDto"];
                    "application/json": components["schemas"]["HoldingDetailDto"];
                    "text/json": components["schemas"]["HoldingDetailDto"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": components["schemas"]["ProblemDetails"];
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
}
