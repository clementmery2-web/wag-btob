INSERT INTO produits (nom, marque, description, categorie, emoji, prix_achat_ht, prix_wag_ht, pmc, tva_taux, ddm, quantite_disponible, quantite_minimum, flux, statut)
VALUES
  ('Thon albacore au naturel 160g', 'Petit Navire', 'Conserve thon albacore', 'Épicerie salée', '🐟', 0.85, 1.20, 2.99, 5.5, CURRENT_DATE + INTERVAL '90 days', 480, 12, 'dropshipping', 'en_ligne'),
  ('Gel douche surgras 500ml', 'Le Petit Marseillais', 'Gel douche nourrissant', 'Hygiène', '🧴', 0.90, 1.40, 3.49, 20, CURRENT_DATE + INTERVAL '180 days', 500, 12, 'dropshipping', 'en_ligne'),
  ('Lessive liquide 40 lavages', 'Skip', 'Lessive concentrée', 'Entretien', '🧹', 2.80, 4.50, 9.99, 20, CURRENT_DATE + INTERVAL '365 days', 200, 6, 'dropshipping', 'en_ligne');

INSERT INTO produits_offres (fournisseur_nom, fournisseur_contact, nb_produits, valeur_estimee, ddm_min, statut, priorite)
VALUES
  ('Thai Union (Petit Navire)', 'contact@thaiunion.fr', 8, 4726, CURRENT_DATE + INTERVAL '14 days', 'nouvelle', 'haute'),
  ('Bonduelle', 'commerciaux@bonduelle.fr', 5, 4010, CURRENT_DATE + INTERVAL '9 days', 'nouvelle', 'haute');
