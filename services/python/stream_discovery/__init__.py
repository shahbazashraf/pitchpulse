"""
Stream Discovery Package
========================
Discovers and validates LEGAL, official public streams for football matches.
"""

from .service import (
    StreamDiscoveryService,
    StreamResult,
    BaseDiscoverer,
    YouTubeDiscoverer,
    BBCiPlayerDiscoverer,
    FIFAPlusDiscoverer,
    HttpClient,
    StreamAvailabilityValidator,
)

from .totalsportek_discoverer import TotalsportekDiscoverer
from .streamseast_discoverer import StreamseastDiscoverer

__all__ = [
    "StreamDiscoveryService",
    "StreamResult",
    "BaseDiscoverer",
    "YouTubeDiscoverer",
    "BBCiPlayerDiscoverer",
    "FIFAPlusDiscoverer",
    "TotalsportekDiscoverer",
    "StreamseastDiscoverer",
    "HttpClient",
    "StreamAvailabilityValidator",
]