import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {DashboardDummyDataProvider,useDashboardDisplayFormat} from "@/components/dashboard/DashboardDisplayFormatContext";
function Amount(){const fmt=useDashboardDisplayFormat();return createElement("span",null,fmt.euroExact(1234.56))}
it("keeps cent precision for source reconciliation",()=>{expect(renderToStaticMarkup(createElement(Amount)).replace(/<[^>]*>/g,"")).toBe(new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(1234.56))});
it("preserves privacy masking for exact currency displays",()=>{const html=renderToStaticMarkup(createElement(DashboardDummyDataProvider,{active:true,children:createElement(Amount)}));expect(html).not.toContain("234,56");});
