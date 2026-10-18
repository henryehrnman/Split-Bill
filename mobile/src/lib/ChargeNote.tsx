import React, {useState} from 'react';
import {TextInput, View} from 'react-native';
import {api} from './api';
import {isDraft, MAX_CHARGE_NOTE_LENGTH, userById} from './domain';
import type {Charge} from './domain';
import {useStore} from './store';
import {Button, C, Label, s, shortDate, T} from './ui';

export function ChargeNote({charge, readOnly = false}: {charge: Charge; readOnly?: boolean}) {
  const {db, viewer, busy, run} = useStore();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const group = db.groups.find(g => g.id === charge.groupId);
  // A note is not the payer's first proposal. Keep that workflow in charge of draft writes.
  const canEdit = !readOnly && !isDraft(charge) && group?.members.some(m => m.userId === viewer.id && m.status === 'joined');
  if (!charge.note && !canEdit) return null;

  const save = async () => {
    const result = await run(actor => api.setChargeNote(actor, charge.id, text), text.trim() ? 'Note saved.' : 'Note cleared.');
    if (result) setEditing(false);
  };

  return (
    <View style={{marginVertical: 12}}>
      {charge.note && !editing && (
        <View style={[s.box, {padding: 12, marginBottom: 8}]}>
          <T style={s.caption}>Note · {userById(db, charge.note.authorId).name} · {shortDate(charge.note.at)}</T>
          <T style={{marginTop: 4}}>{charge.note.text}</T>
        </View>
      )}
      {canEdit && (editing ? (
        <View>
          <Label>Note</Label>
          <TextInput
            accessibilityLabel="Charge note"
            placeholder="What should the group know about this charge?"
            placeholderTextColor={C.muted}
            multiline
            maxLength={MAX_CHARGE_NOTE_LENGTH}
            editable={!busy}
            value={text}
            onChangeText={setText}
            style={[s.input, {minHeight: 92, textAlignVertical: 'top'}]}
          />
          <T style={s.caption}>Shared with your group · {text.length}/{MAX_CHARGE_NOTE_LENGTH}</T>
          {charge.note && <T style={s.caption}>Leave blank to clear this note.</T>}
          <Button title="Save note" disabled={!charge.note && !text.trim()} onPress={() => { void save(); }} />
          <Button secondary title="Cancel" onPress={() => setEditing(false)} />
        </View>
      ) : <Button secondary title={charge.note ? 'Edit note' : 'Add note'} onPress={() => { setText(charge.note?.text ?? ''); setEditing(true); }} />)}
    </View>
  );
}
