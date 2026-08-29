import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { LiveMapCanvas } from "@/components/live-map/live-map-canvas";
import { readLiveMapProjection } from "@/features/live-map/read-live-map.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

export const metadata = { title: "Live Map — Hebun AI" };

/*
 * /live-map — L4. LIVE MAP CORE v1.
 *
 * THE TENANT IS RESOLVED HERE, ON THE SERVER. `resolveTenantContext()` takes no argument and the
 * projection takes no organization parameter, so neither this page nor a caller's query string can
 * point the map at another organization.
 *
 * THIS PAGE PERFORMS NO READ OF ITS OWN. One call to one projection, which composes released
 * authorities and owns none of their truth. It holds no database handle, no schema import and no
 * mutation of any kind.
 *
 * IT IS NOT CALLED LIVE BECAUSE IT UPDATES. It is called Live Map because it maps what is live in
 * the organization; the reading itself is a server read taken on request, and the surface says so
 * in its own words rather than implying a stream it does not have.
 */
export default async function LiveMapPage() {
  const projection = await readLiveMapProjection(await resolveTenantContext());

  return (
    <>
      <PageHeader
        title="Live Map"
        context="The organization as Hebun can actually vouch for it — read from authoritative seams, with every domain Hebun does not own stated as such."
        action={<Badge variant="primary">Core v1</Badge>}
      />
      <LiveMapCanvas projection={projection} />
    </>
  );
}
