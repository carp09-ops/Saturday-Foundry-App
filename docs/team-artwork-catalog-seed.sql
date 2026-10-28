insert into public.team_artwork_catalog(team_id,image_url,alt_text,accent_color,published)
select t.id,v.image_url,v.alt_text,v.accent_color,true
from (values
 ('UConn','https://raw.githack.com/carp09-ops/Saturday-Foundry-App/e7c0dfd2471825f58dc85dfe3493cbc9d53b92f5/assets/graphite/report/uconn.webp','UConn helmet editorial artwork','#173656'),
 ('Army','https://raw.githack.com/carp09-ops/Saturday-Foundry-App/e7c0dfd2471825f58dc85dfe3493cbc9d53b92f5/assets/graphite/report/army.webp','Army helmet editorial artwork','#8B733A'),
 ('Kansas','https://raw.githack.com/carp09-ops/Saturday-Foundry-App/e7c0dfd2471825f58dc85dfe3493cbc9d53b92f5/assets/graphite/report/kansas.webp','Kansas helmet editorial artwork','#173E81'),
 ('Florida','https://raw.githack.com/carp09-ops/Saturday-Foundry-App/dc11c7e49339d0891c1177a6ebcaaa2ad2618976/assets/graphite/report/florida.webp','Florida helmet editorial artwork','#0021A5'),
 ('West Virginia','https://raw.githack.com/carp09-ops/Saturday-Foundry-App/dc11c7e49339d0891c1177a6ebcaaa2ad2618976/assets/graphite/report/west-virginia.webp','West Virginia helmet editorial artwork','#002855')
) as v(team_name,image_url,alt_text,accent_color)
join public.teams t on t.name=v.team_name
on conflict(team_id) do update set image_url=excluded.image_url,alt_text=excluded.alt_text,accent_color=excluded.accent_color,published=true
returning team_id,image_url,published;
