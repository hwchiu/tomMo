package domain

import "testing"

func TestFactoryAttrs(t *testing.T) {
	cat, err := NormalizeFactoryCategory(" giga ")
	if err != nil || cat != "GIGA" {
		t.Fatalf("category %q %v", cat, err)
	}
	if _, err := NormalizeFactoryCategory("Phase"); err != nil {
		t.Fatal(err)
	}
	if _, err := NormalizeFactoryCategory("N3"); err == nil || err.Error() != FactoryCategoryInvalid {
		t.Fatalf("bad category %v", err)
	}
	reg, err := NormalizeFactoryRegion("jp")
	if err != nil || reg != "JP" {
		t.Fatalf("region %q %v", reg, err)
	}
	if _, err := NormalizeFactoryRegion("OVERSEA"); err == nil || err.Error() != FactoryRegionInvalid {
		t.Fatalf("oversea %v", err)
	}
	if FactoryCategoryLabel("GIGA") != "Giga" || FactoryRegionLabel("AZ") != "AZ" {
		t.Fatal("labels")
	}
	if LegacyOverseaRegion("熊本一廠", "熊本") != "JP" || LegacyOverseaRegion("亞利桑那一廠", "亞利桑那") != "AZ" || LegacyOverseaRegion("新加坡一廠", "新加坡") != "EU" {
		t.Fatal("legacy oversea")
	}
}
