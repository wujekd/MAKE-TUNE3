# Make Tunes


todo:
- breakdown and analyse collaboration service and add tests
    v changed the testing framework from jest to vitest
    v updatesd audio engine tests to vitest and fxed mock audio context
    v write tests for collaboraiton service
    v break down the collaboration file
- do the same with the 'store' file --> nah fuck that, do that later
    - plan refactor
    - write tests
    - break down to separate files


- implement the moderation system. should mods be able to adjust eq? who desides? both settings saved?
- run an automated git test?

~~~~~~~~~~~~
Collab after closing:
After the collab is resolved, the winning submissions is saved. 
The user is able to add a new mix which will represent result of merging the winning submission with the original material ??
when the past stage is played back from the project history component:

~UX~
if there is no new mix uploaded and no following collabs original backing track and winning submissions are played.
if theres a mix uploaded that mix will be played and optionally original track +
 submission + winning submission can be played?

 v quick fix: for now just play submission and backing in respective players
~~~~~~~~~~

## administration system
v - only allow admins to admin paths
v - add report submission (offensive etc) + view to review reports
