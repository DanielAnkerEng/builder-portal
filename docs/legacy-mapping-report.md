# Legacy mapping report

No browser-local state was read during repository implementation. The exporter must be run on every browser/profile that used the legacy portal; additional accounts or changed names may exist there.

Known legacy account definitions all require explicit mapping because the current production companies are named Wreach, Test Bedrift 4, Test Bedrift 5, or Testbedrift 3 and no unique evidence connects these demo projects to one of those company UUIDs.

| Legacy account | Project | Legacy email | Mapping status |
|---|---|---|---|
| `acc_bruker` | Mitt nettsideprosjekt | bruker@studionord.no | Human confirmation required |
| `acc_fjord` | Fjord Eiendom | demo@fjordbolig.no | Human confirmation required |
| `acc_salong` | Nordlys Hårstudio | hei@nordlysstudio.no | Human confirmation required |
| `acc_ror` | Trygg Rørservice | post@tryggror.no | Human confirmation required |
| `acc_regnskap` | Klar Regnskap | hei@klarregnskap.no | Human confirmation required |
| `acc_mat` | Fjordgrill | bestilling@fjordgrill.no | Human confirmation required |

The legacy admin account has no website state and is excluded. Duplicate Test Bedrift names are never auto-associated. A staged export remains `needs_mapping` until an AAL2 platform administrator confirms one exact company UUID.
