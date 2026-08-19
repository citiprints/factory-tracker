export const EMPTY_CUSTOMER_FORM = {
	name: "", email: "", phone: "", secondaryPhone: "", company: "", address: "", gstin: "",
	deliveryContactName: "", deliveryPhone: "", deliverySecondaryPhone: "", deliveryAddress: "", deliveryNotes: "",
};

export type CustomerFormState = typeof EMPTY_CUSTOMER_FORM;

export function customerFormToPayload(v: CustomerFormState) {
	return {
		name: v.name,
		email: v.email || undefined,
		phone: v.phone || undefined,
		secondaryPhone: v.secondaryPhone || undefined,
		company: v.company || undefined,
		address: v.address || undefined,
		gstin: v.gstin || undefined,
		deliveryContactName: v.deliveryContactName || undefined,
		deliveryPhone: v.deliveryPhone || undefined,
		deliverySecondaryPhone: v.deliverySecondaryPhone || undefined,
		deliveryAddress: v.deliveryAddress || undefined,
		deliveryNotes: v.deliveryNotes || undefined,
	};
}

// Same billing/delivery fields the onboarding form collects — the Customer
// record is the one source of truth both read from and write back to. Used
// wherever a customer can be created or edited (Customers page, and the
// quick "Add New Customer" form on the task create/edit forms) so they never
// drift out of sync with each other.
export function CustomerFields({ values, onChange, idPrefix }: { values: CustomerFormState; onChange: (key: keyof CustomerFormState, value: string) => void; idPrefix: string }) {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div className="sm:col-span-2">
					<label className="field-label" htmlFor={`${idPrefix}-name`}>Name</label>
					<input id={`${idPrefix}-name`} className="input" value={values.name} onChange={e => onChange("name", e.target.value)} required />
				</div>
				<div className="sm:col-span-2">
					<label className="field-label" htmlFor={`${idPrefix}-company`}>Company</label>
					<input id={`${idPrefix}-company`} className="input" value={values.company} onChange={e => onChange("company", e.target.value)} />
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="text-sm font-medium">Billing details</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<input className="input" type="email" placeholder="Email" value={values.email} onChange={e => onChange("email", e.target.value)} />
					<input className="input" placeholder="Phone" value={values.phone} onChange={e => onChange("phone", e.target.value)} />
					<input className="input" placeholder="Secondary phone" value={values.secondaryPhone} onChange={e => onChange("secondaryPhone", e.target.value)} />
					<input className="input" placeholder="GSTIN / Tax ID" value={values.gstin} onChange={e => onChange("gstin", e.target.value)} />
					<textarea className="input sm:col-span-2" placeholder="Billing address" value={values.address} onChange={e => onChange("address", e.target.value)} />
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="text-sm font-medium">Delivery details</h3>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<input className="input" placeholder="Contact name" value={values.deliveryContactName} onChange={e => onChange("deliveryContactName", e.target.value)} />
					<input className="input" placeholder="Delivery phone" value={values.deliveryPhone} onChange={e => onChange("deliveryPhone", e.target.value)} />
					<input className="input" placeholder="Secondary phone" value={values.deliverySecondaryPhone} onChange={e => onChange("deliverySecondaryPhone", e.target.value)} />
					<textarea className="input sm:col-span-2" placeholder="Delivery address" value={values.deliveryAddress} onChange={e => onChange("deliveryAddress", e.target.value)} />
					<textarea className="input sm:col-span-2" placeholder="Delivery notes" value={values.deliveryNotes} onChange={e => onChange("deliveryNotes", e.target.value)} />
				</div>
			</div>
		</div>
	);
}
