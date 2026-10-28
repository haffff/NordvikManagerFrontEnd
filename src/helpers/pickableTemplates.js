// Templates to offer in pickers. Hidden ones (e.g. an addon's internal template that
// only its importer clones) stay in the template list — the Templates panel shows
// them and "update from template" finds them — but aren't offered to pick.
export const pickableTemplates = (templates) => (templates ?? []).filter((t) => !t.isHidden);

export default pickableTemplates;
